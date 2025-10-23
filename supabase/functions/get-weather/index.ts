import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WEATHER_API_KEY = Deno.env.get("OPENWEATHER_API_KEY");
    console.log("Weather API key exists:", !!WEATHER_API_KEY);
    
    if (!WEATHER_API_KEY) {
      console.error("OPENWEATHER_API_KEY not configured");
      throw new Error("OPENWEATHER_API_KEY not configured");
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=Davanagere,IN&units=metric&appid=${WEATHER_API_KEY}`;
    console.log("Fetching weather from OpenWeatherMap...");
    
    const response = await fetch(weatherUrl);
    console.log("Weather API response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Weather API error:", response.status, errorText);
      throw new Error(`Weather API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Weather data received:", JSON.stringify(data));
    
    const weatherData = {
      temp: data.main.temp,
      condition: data.weather[0].main,
      description: data.weather[0].description,
    };
    
    console.log("Processed weather data:", weatherData);

    return new Response(JSON.stringify(weatherData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching weather:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
