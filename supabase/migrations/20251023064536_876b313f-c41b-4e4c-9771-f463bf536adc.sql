-- Enable realtime for tasks table to track task updates
ALTER TABLE public.tasks REPLICA IDENTITY FULL;

-- Add tasks table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;