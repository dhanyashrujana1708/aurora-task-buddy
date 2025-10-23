import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    console.log("Fetching tasks for user:", user.id);

    // Get tasks from the past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: pastTasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .gte("scheduled_date", sevenDaysAgo.toISOString())
      .order("scheduled_date", { ascending: false });

    if (tasksError) throw tasksError;

    console.log(`Found ${pastTasks?.length || 0} tasks from past week`);

    if (!pastTasks || pastTasks.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No tasks found in the past week to learn from",
          tasks: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Analyze patterns
    const taskAnalysis = {
      categories: [...new Set(pastTasks.map((t) => t.category).filter(Boolean))],
      priorities: pastTasks.reduce((acc, t) => {
        acc[t.priority] = (acc[t.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      commonTimes: pastTasks.map((t) => {
        const date = new Date(t.scheduled_date);
        return date.getHours();
      }),
      outdoorTasks: pastTasks.filter((t) => t.is_outdoor).length,
      totalTasks: pastTasks.length,
    };

    console.log("Task analysis:", taskAnalysis);

    // Use AI to generate new tasks based on patterns
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const prompt = `Based on the following user's task patterns from the past week, generate 5-7 new tasks for the upcoming week that match their preferences and habits.

Task Analysis:
- Categories used: ${taskAnalysis.categories.join(", ")}
- Priority distribution: ${JSON.stringify(taskAnalysis.priorities)}
- Common task times: ${Math.round(taskAnalysis.commonTimes.reduce((a, b) => a + b, 0) / taskAnalysis.commonTimes.length)}:00
- Outdoor tasks: ${taskAnalysis.outdoorTasks} out of ${taskAnalysis.totalTasks}

Recent tasks:
${pastTasks.slice(0, 10).map(t => `- ${t.title} (${t.priority}, ${t.category || 'general'})`).join('\n')}

Generate tasks that:
1. Match their typical categories and priorities
2. Are scheduled at similar times they usually work
3. Include a mix of routine and productive tasks
4. Consider if they do outdoor activities

Return ONLY a JSON array of task objects with this structure:
[
  {
    "title": "task title",
    "description": "brief description",
    "priority": "low|medium|high",
    "category": "category name",
    "is_outdoor": true/false,
    "scheduled_date": "ISO date string for upcoming week"
  }
]`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a task planning assistant. Generate practical, realistic tasks based on user patterns. Return only valid JSON.",
            },
            { role: "user", content: prompt },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    console.log("AI response:", aiContent);

    // Parse AI response
    let generatedTasks;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array found in response");
      generatedTasks = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Failed to parse AI-generated tasks");
    }

    // Insert generated tasks
    const tasksToInsert = generatedTasks.map((task: any) => ({
      user_id: user.id,
      title: task.title,
      description: task.description || null,
      priority: task.priority || "medium",
      category: task.category || null,
      is_outdoor: task.is_outdoor || false,
      scheduled_date: task.scheduled_date,
      completed: false,
    }));

    const { data: insertedTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(tasksToInsert)
      .select();

    if (insertError) throw insertError;

    console.log(`Successfully created ${insertedTasks?.length || 0} tasks`);

    return new Response(
      JSON.stringify({
        message: `Successfully generated ${insertedTasks?.length} tasks based on your patterns`,
        tasks: insertedTasks,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in auto-generate-tasks:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
