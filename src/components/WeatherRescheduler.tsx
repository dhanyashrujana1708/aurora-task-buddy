import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudRain, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, startOfDay } from "date-fns";

interface Task {
  id: string;
  title: string;
  scheduled_date: string;
  is_outdoor: boolean;
}

interface Weather {
  temp: number;
  condition: string;
  description: string;
}

interface WeatherReschedulerProps {
  onReschedule: () => void;
}

export const WeatherRescheduler = ({ onReschedule }: WeatherReschedulerProps) => {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [outdoorTasks, setOutdoorTasks] = useState<Task[]>([]);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    checkWeatherAndTasks();
  }, []);

  const checkWeatherAndTasks = async () => {
    try {
      // Fetch weather
      const { data: weatherData, error: weatherError } = await supabase.functions.invoke("get-weather");
      if (weatherError) throw weatherError;
      setWeather(weatherData);

      // Fetch today's outdoor tasks
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const today = new Date();
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", session.session.user.id)
        .eq("is_outdoor", true)
        .gte("scheduled_date", startOfDay(today).toISOString())
        .lte("scheduled_date", startOfDay(addDays(today, 1)).toISOString());

      if (tasksError) throw tasksError;
      setOutdoorTasks(tasks || []);

      // Check if weather is bad and we have outdoor tasks
      const isBadWeather = weatherData && (
        weatherData.condition.toLowerCase().includes("rain") ||
        weatherData.condition.toLowerCase().includes("storm") ||
        weatherData.condition.toLowerCase().includes("snow")
      );

      if (isBadWeather && tasks && tasks.length > 0) {
        setShowWarning(true);
      }
    } catch (error) {
      console.error("Error checking weather and tasks:", error);
    }
  };

  const isBadWeather = () => {
    if (testMode) return true; // Force bad weather in test mode
    if (!weather) return false;
    return (
      weather.condition.toLowerCase().includes("rain") ||
      weather.condition.toLowerCase().includes("storm") ||
      weather.condition.toLowerCase().includes("snow")
    );
  };

  const enableTestMode = () => {
    setTestMode(true);
    setShowWarning(true);
    toast.info("Test mode enabled - simulating bad weather");
  };

  const rescheduleOutdoorTasks = async () => {
    setIsRescheduling(true);
    try {
      const tomorrow = addDays(new Date(), 1);
      
      // Update all outdoor tasks to tomorrow
      for (const task of outdoorTasks) {
        const currentDate = new Date(task.scheduled_date);
        const newDate = new Date(tomorrow);
        newDate.setHours(currentDate.getHours());
        newDate.setMinutes(currentDate.getMinutes());

        const { error } = await supabase
          .from("tasks")
          .update({ scheduled_date: newDate.toISOString() })
          .eq("id", task.id);

        if (error) throw error;
      }

      toast.success(`Rescheduled ${outdoorTasks.length} outdoor task(s) to tomorrow due to bad weather`);
      setShowWarning(false);
      setOutdoorTasks([]);
      onReschedule();
    } catch (error) {
      console.error("Error rescheduling tasks:", error);
      toast.error("Failed to reschedule tasks");
    } finally {
      setIsRescheduling(false);
    }
  };

  // Show test button if we have outdoor tasks but weather is good
  if (!showWarning || !isBadWeather()) {
    if (outdoorTasks.length > 0 && !testMode) {
      return (
        <Card className="aurora-card p-4 border-blue-500/50 bg-blue-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                You have {outdoorTasks.length} outdoor task(s) scheduled for today.
                Current weather: {weather?.description || "Loading..."}
              </p>
            </div>
            <Button onClick={enableTestMode} variant="outline" size="sm">
              Test Rescheduler
            </Button>
          </div>
        </Card>
      );
    }
    return null;
  }

  return (
    <Card className="aurora-card p-4 border-yellow-500/50 bg-yellow-500/10">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-yellow-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <CloudRain className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold">Bad Weather Alert</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {testMode ? (
              <>🧪 Test Mode: Simulating bad weather. </>
            ) : null}
            You have {outdoorTasks.length} outdoor task(s) scheduled for today, but the weather is {testMode ? "rainy" : weather?.description}.
            Would you like to reschedule them to tomorrow?
          </p>
          <div className="flex gap-2">
            <Button 
              onClick={rescheduleOutdoorTasks} 
              disabled={isRescheduling}
              size="sm"
            >
              {isRescheduling ? "Rescheduling..." : "Reschedule to Tomorrow"}
            </Button>
            <Button 
              onClick={() => setShowWarning(false)} 
              variant="outline"
              size="sm"
            >
              Keep as Scheduled
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};