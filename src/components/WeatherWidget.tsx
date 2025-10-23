import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Cloud, CloudRain, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Weather {
  temp: number;
  condition: string;
  description: string;
}

export const WeatherWidget = () => {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWeather();
  }, []);

  const fetchWeather = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-weather");
      if (error) throw error;
      setWeather(data);
    } catch (error) {
      console.error("Error fetching weather:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getWeatherIcon = () => {
    if (!weather) return <Cloud className="w-8 h-8" />;
    
    if (weather.condition.toLowerCase().includes("rain")) {
      return <CloudRain className="w-8 h-8 text-blue-400" />;
    } else if (weather.condition.toLowerCase().includes("clear") || 
               weather.condition.toLowerCase().includes("sun")) {
      return <Sun className="w-8 h-8 text-yellow-400" />;
    }
    return <Cloud className="w-8 h-8" />;
  };

  if (isLoading) {
    return (
      <Card className="aurora-card p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-24 mb-2"></div>
          <div className="h-8 bg-muted rounded w-32"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="aurora-card p-4">
      <div className="flex items-center gap-4">
        {getWeatherIcon()}
        <div>
          <p className="text-sm text-muted-foreground">Davanagere, India</p>
          {weather && (
            <>
              <p className="text-2xl font-bold">{Math.round(weather.temp)}°C</p>
              <p className="text-sm text-muted-foreground capitalize">
                {weather.description}
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};
