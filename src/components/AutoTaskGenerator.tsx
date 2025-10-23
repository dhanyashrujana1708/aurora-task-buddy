import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AutoTaskGeneratorProps {
  onTasksGenerated: () => void;
}

export const AutoTaskGenerator = ({ onTasksGenerated }: AutoTaskGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateTasks = async () => {
    try {
      setIsGenerating(true);
      toast.info("Analyzing your task patterns...");

      const { data, error } = await supabase.functions.invoke("auto-generate-tasks");

      if (error) throw error;

      if (data.tasks && data.tasks.length > 0) {
        toast.success(data.message || `Generated ${data.tasks.length} new tasks!`);
        onTasksGenerated();
      } else {
        toast.info(data.message || "No tasks generated");
      }
    } catch (error: any) {
      console.error("Error generating tasks:", error);
      toast.error(error.message || "Failed to generate tasks");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="aurora-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">AI Task Generator</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatically generate tasks based on your weekly patterns
          </p>
        </div>
        <Button
          onClick={handleGenerateTasks}
          disabled={isGenerating}
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Tasks
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
