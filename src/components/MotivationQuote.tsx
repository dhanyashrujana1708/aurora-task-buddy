import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface QuoteData {
  quote: string;
  author: string;
}

export const MotivationQuote = () => {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQuote();
  }, []);

  const fetchQuote = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-motivation-quote");
      if (error) throw error;
      setQuote(data);
    } catch (error) {
      console.error("Error fetching quote:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="aurora-card p-6 aurora-glow">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-full mb-2"></div>
          <div className="h-4 bg-muted rounded w-3/4"></div>
        </div>
      </Card>
    );
  }

  if (!quote) return null;

  return (
    <Card className="aurora-card p-6 aurora-glow">
      <div className="flex gap-4">
        <Quote className="w-8 h-8 text-primary flex-shrink-0" />
        <div className="space-y-2">
          <p className="text-lg italic font-medium">{quote.quote}</p>
          <p className="text-sm text-muted-foreground">— {quote.author}</p>
        </div>
      </div>
    </Card>
  );
};
