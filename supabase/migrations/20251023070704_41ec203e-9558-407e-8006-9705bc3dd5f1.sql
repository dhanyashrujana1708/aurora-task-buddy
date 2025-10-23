-- Fix the log_task_completion function to have proper search_path
DROP FUNCTION IF EXISTS log_task_completion() CASCADE;

CREATE OR REPLACE FUNCTION log_task_completion()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed = TRUE AND OLD.completed = FALSE THEN
    INSERT INTO public.task_analytics (
      user_id,
      task_id,
      scheduled_time,
      completed_time,
      priority,
      category
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.scheduled_date,
      NOW(),
      NEW.priority,
      NEW.category
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER task_completion_logger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_completion();