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

    const now = new Date();
    
    // Find all incomplete tasks that are overdue
    const { data: overdueTasks, error: fetchError } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .lt('scheduled_date', now.toISOString());

    if (fetchError) {
      console.error('Error fetching overdue tasks:', fetchError);
      throw fetchError;
    }

    if (!overdueTasks || overdueTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No overdue tasks to reschedule' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reschedule each overdue task to tomorrow at the same time
    const updates = overdueTasks.map(task => {
      const scheduledDate = new Date(task.scheduled_date);
      const tomorrow = new Date(scheduledDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return supabaseClient
        .from('tasks')
        .update({ scheduled_date: tomorrow.toISOString() })
        .eq('id', task.id);
    });

    await Promise.all(updates);

    console.log(`Rescheduled ${overdueTasks.length} overdue tasks to tomorrow`);

    return new Response(
      JSON.stringify({ 
        message: `Successfully rescheduled ${overdueTasks.length} tasks`,
        rescheduled: overdueTasks.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reschedule-overdue-tasks:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
