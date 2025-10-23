-- Schedule automatic AI analysis to run every 6 hours
SELECT cron.schedule(
  'auto-ai-analysis',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT
    net.http_post(
        url:='https://qnabmzmdgughmhiurirx.supabase.co/functions/v1/auto-analyze-tasks',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYWJtem1kZ3VnaG1oaXVyaXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNzcwODMsImV4cCI6MjA3Njc1MzA4M30.iqR-JTMff6LlPoLsOM7K12YEI1R9lcDG4XOVNYosebY"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);