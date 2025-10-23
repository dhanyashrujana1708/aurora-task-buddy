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
    // Using OpenWeatherMap API for Davanagere, India
    // For production, you'd want to get an API key from openweathermap.org
    // For now, we'll return mock data to get started
    const weatherData = {
      temp: 28,
      condition: "Clear",
      description: "clear sky",
    };

    // In production with API key:
    // const WEATHER_API_KEY = Deno.env.get("OPENWEATHER_API_KEY");
    // const response = await fetch(
    //   `https://api.openweathermap.org/data/2.5/weather?q=Davanagere,IN&units=metric&appid=${WEATHER_API_KEY}`
    // );
    // const data = await response.json();
    // const weatherData = {
    //   temp: data.main.temp,
    //   condition: data.weather[0].main,
    //   description: data.weather[0].description,
    // };

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
