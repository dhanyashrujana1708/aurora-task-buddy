import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { message, conversationHistory } = await req.json();
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Get current date/time for context - User is in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istNow = new Date(now.getTime() + istOffset);
    
    const currentDateString = istNow.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'UTC' // We've already adjusted to IST, so read as UTC
    });
    
    const currentTimeString = istNow.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    });

    const systemPrompt = `You are Aurora, an AI task planning assistant. You help users manage their tasks naturally and intelligently.

IMPORTANT: Current date and time in India (IST): ${currentDateString}, ${currentTimeString}

Your capabilities:
1. Add new tasks with details (title, description, date/time, priority, category, whether it's outdoor)
2. Modify existing tasks
3. Mark tasks as complete
4. Suggest task priorities and scheduling
5. Answer questions about tasks

When users request to add a task, extract:
- Title (required)
- Description (optional)
- Scheduled date/time: When user specifies a time like "1 PM" or "3:30 PM", interpret it as IST (India Standard Time). Return the ISO string in UTC by subtracting 5 hours 30 minutes. For example: "1:00 PM IST today" should be "${istNow.toISOString().split('T')[0]}T07:30:00.000Z" (1 PM - 5:30 hours = 7:30 AM UTC).
- Priority (low/medium/high, default medium)
- Category (optional)
- Is outdoor task (true/false, default false)

CRITICAL TIME CONVERSION: 
- User times are in IST (UTC+5:30)
- Database needs UTC time
- Subtract 5 hours 30 minutes from user's requested time
- Example: User says "2 PM" → Save as "08:30:00.000Z" (2 PM - 5:30 = 8:30 AM UTC)

CRITICAL: Always calculate dates relative to the current IST date (${currentDateString}). 
- "today" = ${istNow.toISOString().split('T')[0]}
- "tomorrow" = ${new Date(istNow.getTime() + 86400000).toISOString().split('T')[0]}

Be conversational, helpful, and proactive in organizing tasks efficiently.

Current user ID: ${user.id}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          tools: [
            {
              type: "function",
              function: {
                name: "add_task",
                description: "Add a new task for the user",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    scheduled_date: {
                      type: "string",
                      description: "ISO 8601 datetime string",
                    },
                    priority: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },
                    category: { type: "string" },
                    is_outdoor: { type: "boolean" },
                  },
                  required: ["title", "scheduled_date"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "update_task",
                description: "Update an existing task",
                parameters: {
                  type: "object",
                  properties: {
                    task_id: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    scheduled_date: { type: "string" },
                    priority: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },
                    completed: { type: "boolean" },
                    is_outdoor: { type: "boolean" },
                  },
                  required: ["task_id"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "list_tasks",
                description: "List user's tasks for a specific date range",
                parameters: {
                  type: "object",
                  properties: {
                    start_date: { type: "string" },
                    end_date: { type: "string" },
                  },
                },
              },
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const aiMessage = data.choices[0].message;

    let actionPerformed = false;
    let responseText = aiMessage.content || "";

    // Handle function calls
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      for (const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        console.log("Function call:", functionName, args);

        if (functionName === "add_task") {
          const { error } = await supabaseClient.from("tasks").insert({
            user_id: user.id,
            title: args.title,
            description: args.description || null,
            scheduled_date: args.scheduled_date,
            priority: args.priority || "medium",
            category: args.category || null,
            is_outdoor: args.is_outdoor || false,
          });

          if (error) {
            responseText = `I encountered an error adding the task: ${error.message}`;
          } else {
            responseText = `✅ Task added successfully! "${args.title}" is scheduled for ${new Date(
              args.scheduled_date
            ).toLocaleString()}.`;
            actionPerformed = true;
          }
        } else if (functionName === "update_task") {
          const updateData: any = {};
          if (args.title) updateData.title = args.title;
          if (args.description !== undefined)
            updateData.description = args.description;
          if (args.scheduled_date) updateData.scheduled_date = args.scheduled_date;
          if (args.priority) updateData.priority = args.priority;
          if (args.completed !== undefined)
            updateData.completed = args.completed;
          if (args.is_outdoor !== undefined)
            updateData.is_outdoor = args.is_outdoor;

          const { error } = await supabaseClient
            .from("tasks")
            .update(updateData)
            .eq("id", args.task_id)
            .eq("user_id", user.id);

          if (error) {
            responseText = `I encountered an error updating the task: ${error.message}`;
          } else {
            responseText = `✅ Task updated successfully!`;
            actionPerformed = true;
          }
        } else if (functionName === "list_tasks") {
          let query = supabaseClient
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .order("scheduled_date", { ascending: true });

          if (args.start_date) {
            query = query.gte("scheduled_date", args.start_date);
          }
          if (args.end_date) {
            query = query.lte("scheduled_date", args.end_date);
          }

          const { data: tasks, error } = await query;

          if (error) {
            responseText = `Error fetching tasks: ${error.message}`;
          } else if (tasks.length === 0) {
            responseText = "You don't have any tasks in this period.";
          } else {
            responseText = `Here are your tasks:\n\n${tasks
              .map(
                (t: any) =>
                  `• ${t.title} - ${new Date(
                    t.scheduled_date
                  ).toLocaleString()} (${t.priority} priority)${
                    t.completed ? " ✓" : ""
                  }`
              )
              .join("\n")}`;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        response: responseText,
        action: actionPerformed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
