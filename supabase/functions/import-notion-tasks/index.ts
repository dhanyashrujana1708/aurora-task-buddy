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
    const { notionDatabaseId } = await req.json();
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

    // Get user's Notion API key from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("notion_api_key")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.notion_api_key) {
      throw new Error("Notion API key not configured in profile");
    }

    const notionApiKey = profile.notion_api_key;

    console.log("Fetching tasks from Notion database:", notionDatabaseId);

    // Query Notion database
    const notionResponse = await fetch(
      `https://api.notion.com/v1/databases/${notionDatabaseId}/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 100,
        }),
      }
    );

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text();
      console.error("Notion API error:", errorText);
      throw new Error(`Notion API error: ${notionResponse.status} - ${errorText}`);
    }

    const notionData = await notionResponse.json();
    console.log("Notion response:", JSON.stringify(notionData, null, 2));

    let importedCount = 0;
    let skippedCount = 0;

    // Process each Notion page (task)
    for (const page of notionData.results) {
      try {
        // Check if task already exists
        const { data: existingTask } = await supabaseClient
          .from("tasks")
          .select("id")
          .eq("notion_id", page.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingTask) {
          console.log("Task already exists, skipping:", page.id);
          skippedCount++;
          continue;
        }

        // Extract task data from Notion page properties
        const properties = page.properties;
        
        // Get title (Task Name property - note the space!)
        const titleProp = properties["Task Name"] || properties.Name || properties.Title || properties.Task;
        let title = "Untitled Task";
        if (titleProp?.title && titleProp.title.length > 0) {
          title = titleProp.title[0].plain_text;
        }

        // Get due date
        const dateProp = properties.Date || properties["Due Date"] || properties.Deadline;
        let scheduledDate = new Date();
        if (dateProp?.date?.start) {
          scheduledDate = new Date(dateProp.date.start);
        }

        // Get status/completed
        const statusProp = properties.Status || properties.Done;
        let completed = false;
        if (statusProp?.checkbox !== undefined) {
          completed = statusProp.checkbox;
        } else if (statusProp?.select?.name) {
          completed = statusProp.select.name.toLowerCase().includes("done") ||
                     statusProp.select.name.toLowerCase().includes("complete");
        }

        // Get priority
        const priorityProp = properties.Priority;
        let priority = "medium";
        if (priorityProp?.select?.name) {
          const priorityName = priorityProp.select.name.toLowerCase();
          if (priorityName.includes("high") || priorityName.includes("urgent")) {
            priority = "high";
          } else if (priorityName.includes("low")) {
            priority = "low";
          }
        }

        // Get category
        const categoryProp = properties.Category || properties.Type;
        let category = null;
        if (categoryProp?.select?.name) {
          category = categoryProp.select.name;
        }

        // Check if outdoor - check both "Is Outdoor" checkbox and "Context" multi_select
        const isOutdoorProp = properties["Is Outdoor"] || properties.Outdoor;
        const contextProp = properties.Context;
        let isOutdoor = false;
        
        if (isOutdoorProp?.checkbox !== undefined) {
          isOutdoor = isOutdoorProp.checkbox;
        } else if (contextProp?.multi_select) {
          // Check if "outdoor" is in the Context tags
          isOutdoor = contextProp.multi_select.some(
            (tag: any) => tag.name.toLowerCase() === "outdoor"
          );
        }

        // Insert task
        const { error: insertError } = await supabaseClient.from("tasks").insert({
          user_id: user.id,
          title,
          description: null,
          scheduled_date: scheduledDate.toISOString(),
          completed,
          priority,
          category,
          is_outdoor: isOutdoor,
          notion_id: page.id,
        });

        if (insertError) {
          console.error("Error inserting task:", insertError);
          throw insertError;
        }

        importedCount++;
        console.log("Imported task:", title);
      } catch (error) {
        console.error("Error processing Notion page:", page.id, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        total: notionData.results.length,
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
