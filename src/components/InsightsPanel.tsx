import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Brain, Target, Clock } from "lucide-react";

interface Pattern {
  pattern_type: string;
  pattern_data: any;
  confidence_score: number;
}

export const InsightsPanel = ({ userId }: { userId: string }) => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    if (!userId) return;

    const fetchInsights = async () => {
      // Fetch patterns
      const { data: patternsData } = await supabase
        .from('user_patterns')
        .select('*')
        .eq('user_id', userId)
        .order('confidence_score', { ascending: false })
        .limit(5);

      setPatterns(patternsData || []);

      // Fetch stats
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId);

      const { data: analyticsData } = await supabase
        .from('task_analytics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      const completed = tasksData?.filter(t => t.completed).length || 0;
      const total = tasksData?.length || 0;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Calculate average completion time
      const completionTimes = analyticsData?.map(a => {
        const scheduled = new Date(a.scheduled_time);
        const completed = new Date(a.completed_time);
        return completed.getTime() - scheduled.getTime();
      }) || [];
      
      const avgDelay = completionTimes.length > 0
        ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length / (1000 * 60 * 60))
        : 0;

      setStats({
        completionRate,
        avgDelay,
        tasksCompleted: completed,
        totalTasks: total
      });
    };

    fetchInsights();
  }, [userId]);

  const getPatternInsight = (pattern: Pattern) => {
    if (pattern.pattern_type === 'productive_hours') {
      const hours = pattern.pattern_data.hours || [];
      return `You're most productive at ${hours.map((h: number) => `${h}:00`).join(', ')}`;
    } else if (pattern.pattern_type === 'category_preference') {
      const prefs = pattern.pattern_data.preferences || [];
      const topCat = prefs[0]?.category;
      return `You focus most on "${topCat}" tasks`;
    }
    return JSON.stringify(pattern.pattern_data);
  };

  return (
    <div className="space-y-4">
      <Card className="aurora-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>Your Insights</CardTitle>
          </div>
          <CardDescription>AI-learned patterns from your behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-primary/10">
              <div className="flex items-center gap-2 text-primary mb-2">
                <Target className="h-4 w-4" />
                <span className="text-sm font-medium">Completion Rate</span>
              </div>
              <p className="text-2xl font-bold">{stats.completionRate}%</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10">
              <div className="flex items-center gap-2 text-purple-500 mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Avg Delay</span>
              </div>
              <p className="text-2xl font-bold">{stats.avgDelay}h</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Learned Patterns
            </h4>
            {patterns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keep completing tasks to help AI learn your patterns!
              </p>
            ) : (
              patterns.map((pattern, idx) => (
                <div key={idx} className="p-3 rounded bg-muted/50 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium capitalize">
                      {pattern.pattern_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(pattern.confidence_score * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-muted-foreground">{getPatternInsight(pattern)}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
