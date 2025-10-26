import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskReminder {
  user_id: string;
  task_id: string;
  title: string;
  scheduled_date: string;
}

interface PushSubscription {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Web Push library - Note: You'll need VAPID keys
async function sendPushNotification(
  subscription: PushSubscription,
  payload: any
) {
  try {
    // For now, we'll log the push notification
    // In production, you'd use web-push library with VAPID keys
    console.log('Would send push notification to:', subscription.endpoint);
    console.log('Payload:', payload);
    
    // TODO: Implement actual web-push sending with VAPID keys
    // const webpush = require('web-push');
    // webpush.setVapidDetails(
    //   'mailto:your-email@example.com',
    //   process.env.VAPID_PUBLIC_KEY,
    //   process.env.VAPID_PRIVATE_KEY
    // );
    // await webpush.sendNotification(subscription, JSON.stringify(payload));
    
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Checking for upcoming tasks...');

    // Get current time and 30 minutes from now
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    const thirtyOneMinutesFromNow = new Date(now.getTime() + 31 * 60 * 1000);

    console.log('Time range:', {
      from: thirtyMinutesFromNow.toISOString(),
      to: thirtyOneMinutesFromNow.toISOString()
    });

    // Find tasks scheduled in the next 30-31 minutes
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('tasks')
      .select('id, user_id, title, scheduled_date')
      .eq('completed', false)
      .gte('scheduled_date', thirtyMinutesFromNow.toISOString())
      .lt('scheduled_date', thirtyOneMinutesFromNow.toISOString());

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    console.log(`Found ${tasks?.length || 0} tasks to notify about`);

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No tasks to notify about' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group tasks by user
    const tasksByUser = new Map<string, TaskReminder[]>();
    for (const task of tasks) {
      if (!tasksByUser.has(task.user_id)) {
        tasksByUser.set(task.user_id, []);
      }
      tasksByUser.get(task.user_id)!.push(task);
    }

    // Get push subscriptions for these users
    const userIds = Array.from(tasksByUser.keys());
    const { data: subscriptions, error: subsError } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      throw subsError;
    }

    console.log(`Found ${subscriptions?.length || 0} push subscriptions`);

    // Send notifications
    let notificationsSent = 0;
    if (subscriptions && subscriptions.length > 0) {
      for (const subscription of subscriptions) {
        const userTasks = tasksByUser.get(subscription.user_id);
        if (!userTasks) continue;

        for (const task of userTasks) {
          const scheduledDate = new Date(task.scheduled_date);
          const istDate = new Date(scheduledDate.getTime() + (5.5 * 60 * 60 * 1000));
          const timeString = istDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'UTC'
          });

          const payload = {
            title: 'Upcoming Task Reminder',
            body: `"${task.title}" starts in 30 minutes at ${timeString}`,
            icon: '/favicon.ico',
            tag: task.id,
            url: '/'
          };

          const sent = await sendPushNotification(
            subscription as PushSubscription,
            payload
          );

          if (sent) notificationsSent++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Notifications processed',
        tasksFound: tasks.length,
        notificationsSent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-push-notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
