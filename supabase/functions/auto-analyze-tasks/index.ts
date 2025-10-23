import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Starting automatic AI analysis for all users...');

    // Get all users who have tasks
    const { data: users, error: usersError } = await supabaseClient
      .from('tasks')
      .select('user_id')
      .neq('user_id', null);

    if (usersError) throw usersError;

    const uniqueUserIds = [...new Set(users?.map(u => u.user_id))];
    console.log(`Found ${uniqueUserIds.length} users with tasks`);

    let analyzed = 0;
    let errors = 0;

    // Run analysis for each user
    for (const userId of uniqueUserIds) {
      try {
        // Call the agentic-ai-planner function for this user
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/agentic-ai-planner`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ 
            action: 'analyze_and_suggest',
            userId 
          })
        });

        if (response.ok) {
          analyzed++;
          console.log(`✓ Analyzed user ${userId}`);
        } else {
          errors++;
          console.error(`✗ Failed to analyze user ${userId}:`, await response.text());
        }
      } catch (error) {
        errors++;
        console.error(`✗ Error analyzing user ${userId}:`, error);
      }
    }

    const message = `Auto-analysis complete: ${analyzed} users analyzed, ${errors} errors`;
    console.log(message);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        analyzed,
        errors,
        totalUsers: uniqueUserIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-analyze-tasks:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
