import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, X, Clock, Lightbulb, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Suggestion {
  id: string;
  suggestion_type: string;
  suggestion_data: {
    title: string;
    reason: string;
    data: any;
    confidence: number;
  };
  status: string;
  created_at: string;
}

export const AgenticAISuggestions = ({ userId, onUpdate }: { userId: string; onUpdate: () => void }) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_suggestions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions((data as any) || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchSuggestions();

      // Listen for new suggestions
      const channel = supabase
        .channel('ai-suggestions-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ai_suggestions',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            fetchSuggestions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('agentic-ai-planner', {
        body: { action: 'analyze_and_suggest' },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast.success(data.message || 'AI analysis complete!');
      fetchSuggestions();
      onUpdate();
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error('Failed to run AI analysis: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const applySuggestion = async (suggestionId: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('agentic-ai-planner', {
        body: { 
          action: 'apply_suggestion',
          suggestionId 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast.success('Suggestion applied!');
      fetchSuggestions();
      onUpdate();
    } catch (error: any) {
      console.error('Apply error:', error);
      toast.error('Failed to apply suggestion: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const rejectSuggestion = async (suggestionId: string) => {
    try {
      await supabase
        .from('ai_suggestions')
        .update({ status: 'rejected' })
        .eq('id', suggestionId);

      toast.info('Suggestion dismissed');
      fetchSuggestions();
    } catch (error: any) {
      toast.error('Failed to dismiss suggestion');
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'new_task': return <Lightbulb className="h-5 w-5" />;
      case 'reschedule': return <Calendar className="h-5 w-5" />;
      case 'reprioritize': return <AlertTriangle className="h-5 w-5" />;
      case 'break_down': return <Sparkles className="h-5 w-5" />;
      case 'time_block': return <Clock className="h-5 w-5" />;
      default: return <Sparkles className="h-5 w-5" />;
    }
  };

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'new_task': return 'bg-blue-500/10 text-blue-500';
      case 'reschedule': return 'bg-purple-500/10 text-purple-500';
      case 'reprioritize': return 'bg-orange-500/10 text-orange-500';
      case 'break_down': return 'bg-green-500/10 text-green-500';
      case 'time_block': return 'bg-cyan-500/10 text-cyan-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <Card className="aurora-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle>AI Agent Suggestions</CardTitle>
          </div>
          <Button 
            onClick={runAnalysis} 
            disabled={analyzing}
            variant="outline"
            size="sm"
          >
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </Button>
        </div>
        <CardDescription>
          Autonomous AI is analyzing your patterns and making smart suggestions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No pending suggestions. Click "Run Analysis" to get AI-powered insights!</p>
          </div>
        ) : (
          suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getSuggestionColor(suggestion.suggestion_type)}`}>
                  {getSuggestionIcon(suggestion.suggestion_type)}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold">{suggestion.suggestion_data.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {suggestion.suggestion_data.reason}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(suggestion.suggestion_data.confidence * 100)}% confident
                    </Badge>
                  </div>
                  
                  {/* Show task details if it's a new task */}
                  {suggestion.suggestion_type === 'new_task' && suggestion.suggestion_data.data && (
                    <div className="text-sm space-y-1 p-3 bg-muted/50 rounded">
                      <p><strong>Description:</strong> {suggestion.suggestion_data.data.description}</p>
                      <p><strong>Priority:</strong> {suggestion.suggestion_data.data.priority}</p>
                      <p><strong>Category:</strong> {suggestion.suggestion_data.data.category}</p>
                      {suggestion.suggestion_data.data.scheduled_date && (
                        <p><strong>Suggested Time:</strong> {new Date(suggestion.suggestion_data.data.scheduled_date).toLocaleString()}</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => applySuggestion(suggestion.id)}
                      disabled={loading}
                      className="flex items-center gap-1"
                    >
                      <Check className="h-4 w-4" />
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectSuggestion(suggestion.id)}
                      disabled={loading}
                      className="flex items-center gap-1"
                    >
                      <X className="h-4 w-4" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
