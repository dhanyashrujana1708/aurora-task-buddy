-- Create table for storing user behavior patterns and preferences
CREATE TABLE IF NOT EXISTS public.user_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL, -- 'task_time', 'category_preference', 'duration_estimate', etc.
  pattern_data JSONB NOT NULL,
  confidence_score DECIMAL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for AI suggestions
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL, -- 'task', 'reschedule', 'prioritize', 'break_down'
  suggestion_data JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'auto_applied'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_at TIMESTAMP WITH TIME ZONE
);

-- Create table for task completion history for learning
CREATE TABLE IF NOT EXISTS public.task_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  completed_time TIMESTAMP WITH TIME ZONE,
  estimated_duration INTEGER, -- in minutes
  actual_duration INTEGER, -- in minutes
  priority TEXT,
  category TEXT,
  was_rescheduled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_patterns
CREATE POLICY "Users can view their own patterns" ON public.user_patterns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patterns" ON public.user_patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patterns" ON public.user_patterns
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for ai_suggestions
CREATE POLICY "Users can view their own suggestions" ON public.ai_suggestions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suggestions" ON public.ai_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions" ON public.ai_suggestions
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for task_analytics
CREATE POLICY "Users can view their own analytics" ON public.task_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics" ON public.task_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger to log task completion
CREATE OR REPLACE FUNCTION log_task_completion()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_completion_logger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_completion();