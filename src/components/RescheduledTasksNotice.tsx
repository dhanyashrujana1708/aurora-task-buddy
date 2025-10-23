import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RescheduledTask {
  id: string;
  title: string;
  original_date: string;
  new_date: string;
}

export const RescheduledTasksNotice = ({ userId }: { userId: string }) => {
  const [rescheduledTasks, setRescheduledTasks] = useState<RescheduledTask[]>([]);

  useEffect(() => {
    if (!userId) return;

    // Listen for task updates
    const channel = supabase
      .channel('task-reschedule-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          // Check if the task was rescheduled (scheduled_date changed)
          if (payload.old.scheduled_date !== payload.new.scheduled_date && !payload.new.completed) {
            const oldDate = new Date(payload.old.scheduled_date);
            const newDate = new Date(payload.new.scheduled_date);
            
            // Only show if it was moved forward (rescheduled to future)
            if (newDate > oldDate) {
              setRescheduledTasks(prev => [
                ...prev,
                {
                  id: payload.new.id,
                  title: payload.new.title,
                  original_date: payload.old.scheduled_date,
                  new_date: payload.new.scheduled_date,
                }
              ]);

              // Auto-dismiss after 10 seconds
              setTimeout(() => {
                setRescheduledTasks(prev => prev.filter(t => t.id !== payload.new.id));
              }, 10000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (rescheduledTasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {rescheduledTasks.map(task => (
        <Alert key={task.id} variant="default" className="animate-in slide-in-from-right">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Task Automatically Rescheduled</AlertTitle>
          <AlertDescription>
            <strong>{task.title}</strong> was moved to tomorrow at{" "}
            {new Date(task.new_date).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
};
