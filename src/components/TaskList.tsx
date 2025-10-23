import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  completed: boolean;
  priority: string;
  category: string | null;
  is_outdoor: boolean;
}

interface TaskListProps {
  tasks: Task[];
  onTaskUpdate: () => void;
}

export const TaskList = ({ tasks, onTaskUpdate }: TaskListProps) => {
  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ completed: !completed })
        .eq("id", taskId);

      if (error) throw error;
      onTaskUpdate();
      toast.success(completed ? "Task marked as incomplete" : "Task completed!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/20 text-destructive";
      case "medium":
        return "bg-accent/20 text-accent-foreground";
      case "low":
        return "bg-secondary/20 text-secondary-foreground";
      default:
        return "bg-muted/20 text-muted-foreground";
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No tasks scheduled for this day
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <Card
          key={task.id}
          className={`aurora-card p-4 transition-all hover:aurora-glow ${
            task.completed ? "opacity-60" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              checked={task.completed}
              onCheckedChange={() => handleToggleComplete(task.id, task.completed)}
              className="mt-1"
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3
                  className={`font-semibold ${
                    task.completed ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {task.title}
                </h3>
                <div className="flex gap-2">
                  <Badge variant="outline" className={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                  {task.is_outdoor && (
                    <Badge variant="outline" className="bg-accent/20">
                      Outdoor
                    </Badge>
                  )}
                </div>
              </div>
              {task.description && (
                <p className="text-sm text-muted-foreground">{task.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{format(new Date(task.scheduled_date), "h:mm a")}</span>
                {task.category && <span>• {task.category}</span>}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
