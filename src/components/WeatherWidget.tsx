import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cloud, CloudRain, Sun, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Weather {
  temp: number;
  condition: string;
  description: string;
}

export const WeatherWidget = () => {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchWeather();
    // Refresh weather every 5 minutes
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchWeather = async () => {
    try {
      setIsRefreshing(true);
      const { data, error } = await supabase.functions.invoke("get-weather");
      if (error) throw error;
      console.log("Weather data from API:", data);
      setWeather(data);
    } catch (error) {
      console.error("Error fetching weather:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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
        <div className="flex-1">
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
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchWeather}
          disabled={isRefreshing}
          className="h-8 w-8"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </Card>
  );
};
