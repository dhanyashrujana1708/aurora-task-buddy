-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the reschedule-overdue-tasks function to run every hour
SELECT cron.schedule(
  'reschedule-overdue-tasks-hourly',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT
    net.http_post(
        url:='https://qnabmzmdgughmhiurirx.supabase.co/functions/v1/reschedule-overdue-tasks',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYWJtem1kZ3VnaG1oaXVyaXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNzcwODMsImV4cCI6MjA3Njc1MzA4M30.iqR-JTMff6LlPoLsOM7K12YEI1R9lcDG4XOVNYosebY"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);