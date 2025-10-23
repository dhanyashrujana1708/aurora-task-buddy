import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT token and verify it
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Verify user authentication by passing the JWT token explicitly
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action } = await req.json();
    console.log('Agentic AI action:', action, 'for user:', user.id);

    if (action === 'analyze_and_suggest') {
      // Fetch user's tasks, patterns, and analytics
      const [tasksRes, patternsRes, analyticsRes] = await Promise.all([
        supabaseAdmin.from('tasks').select('*').eq('user_id', user.id),
        supabaseAdmin.from('user_patterns').select('*').eq('user_id', user.id),
        supabaseAdmin.from('task_analytics').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
      ]);

      const tasks = tasksRes.data || [];
      const patterns = patternsRes.data || [];
      const analytics = analyticsRes.data || [];

      // Build context for AI
      const context = buildAnalysisContext(tasks, patterns, analytics);

      // Call Lovable AI for intelligent analysis
      const aiResponse = await fetch('https://api.lovable.app/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `You are an autonomous AI task planner agent. Analyze user behavior patterns and tasks to make intelligent suggestions.
              
Your capabilities:
1. Suggest new tasks based on patterns and goals
2. Optimize task scheduling based on user preferences
3. Reprioritize tasks based on deadlines and context
4. Break down complex tasks into subtasks
5. Identify time slots for maximum productivity

Provide actionable, specific suggestions with reasoning.`
            },
            {
              role: 'user',
              content: context
            }
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'create_suggestion',
                description: 'Create a task suggestion, scheduling recommendation, or prioritization change',
                parameters: {
                  type: 'object',
                  properties: {
                    suggestions: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          type: { 
                            type: 'string',
                            enum: ['new_task', 'reschedule', 'reprioritize', 'break_down', 'time_block']
                          },
                          title: { type: 'string' },
                          reason: { type: 'string' },
                          data: { 
                            type: 'object',
                            description: 'Task details including title, description, priority, category, scheduled_date, etc.'
                          },
                          confidence: { 
                            type: 'number',
                            description: 'Confidence score 0-1'
                          }
                        },
                        required: ['type', 'title', 'reason', 'data', 'confidence']
                      }
                    }
                  },
                  required: ['suggestions']
                }
              }
            }
          ],
          tool_choice: { type: 'function', function: { name: 'create_suggestion' } }
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', aiResponse.status, errorText);
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      console.log('AI response:', JSON.stringify(aiData));

      // Extract suggestions from tool call
      const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        throw new Error('No tool call in AI response');
      }

      const suggestionsData = JSON.parse(toolCall.function.arguments);
      const suggestions = suggestionsData.suggestions || [];

      // Store suggestions in database
      for (const suggestion of suggestions) {
        await supabaseAdmin.from('ai_suggestions').insert({
          user_id: user.id,
          suggestion_type: suggestion.type,
          suggestion_data: {
            title: suggestion.title,
            reason: suggestion.reason,
            data: suggestion.data,
            confidence: suggestion.confidence
          },
          status: suggestion.confidence > 0.8 ? 'auto_applied' : 'pending'
        });

        // Auto-apply high-confidence suggestions
        if (suggestion.confidence > 0.8 && suggestion.type === 'new_task') {
          await supabaseAdmin.from('tasks').insert({
            user_id: user.id,
            ...suggestion.data
          });
        }
      }

      // Update patterns based on analysis
      await updateUserPatterns(supabaseAdmin, user.id, tasks, analytics);

      return new Response(
        JSON.stringify({ 
          success: true, 
          suggestions,
          message: `Generated ${suggestions.length} intelligent suggestions`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'apply_suggestion') {
      const { suggestionId } = await req.json();
      
      const { data: suggestion } = await supabaseAdmin
        .from('ai_suggestions')
        .select('*')
        .eq('id', suggestionId)
        .eq('user_id', user.id)
        .single();

      if (!suggestion) throw new Error('Suggestion not found');

      const suggestionData = suggestion.suggestion_data;
      
      if (suggestion.suggestion_type === 'new_task') {
        await supabaseAdmin.from('tasks').insert({
          user_id: user.id,
          ...suggestionData.data
        });
      } else if (suggestion.suggestion_type === 'reschedule') {
        await supabaseAdmin.from('tasks')
          .update({ scheduled_date: suggestionData.data.new_time })
          .eq('id', suggestionData.data.task_id)
          .eq('user_id', user.id);
      } else if (suggestion.suggestion_type === 'reprioritize') {
        await supabaseAdmin.from('tasks')
          .update({ priority: suggestionData.data.new_priority })
          .eq('id', suggestionData.data.task_id)
          .eq('user_id', user.id);
      }

      await supabaseAdmin.from('ai_suggestions')
        .update({ status: 'accepted', applied_at: new Date().toISOString() })
        .eq('id', suggestionId);

      return new Response(
        JSON.stringify({ success: true, message: 'Suggestion applied' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in agentic-ai-planner:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function buildAnalysisContext(tasks: any[], patterns: any[], analytics: any[]): string {
  const now = new Date();
  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return `Current Date/Time: ${now.toISOString()}

TASK OVERVIEW:
- Total tasks: ${tasks.length}
- Incomplete: ${incompleteTasks.length}
- Completed: ${completedTasks.length}

INCOMPLETE TASKS:
${incompleteTasks.map(t => `- [${t.priority}] ${t.title} (${t.category || 'uncategorized'}) - Scheduled: ${t.scheduled_date}`).join('\n')}

RECENT COMPLETION PATTERNS:
${analytics.slice(0, 10).map(a => `- Completed at ${a.completed_time} (scheduled for ${a.scheduled_time})`).join('\n')}

IDENTIFIED PATTERNS:
${patterns.map(p => `- ${p.pattern_type}: ${JSON.stringify(p.pattern_data)} (confidence: ${p.confidence_score})`).join('\n')}

ANALYZE:
1. What new tasks should be suggested based on patterns?
2. Should any tasks be rescheduled for better productivity?
3. Should task priorities be adjusted?
4. Should any complex tasks be broken down?
5. What optimal time blocks can be suggested?

Provide specific, actionable suggestions with high confidence scores for auto-application.`;
}

async function updateUserPatterns(supabaseAdmin: any, userId: string, tasks: any[], analytics: any[]) {
  // Analyze task completion times
  const completionTimes: { [hour: number]: number } = {};
  analytics.forEach(a => {
    const hour = new Date(a.completed_time).getHours();
    completionTimes[hour] = (completionTimes[hour] || 0) + 1;
  });

  // Find most productive hours
  const productiveHours = Object.entries(completionTimes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  if (productiveHours.length > 0) {
    await supabaseAdmin.from('user_patterns').upsert({
      user_id: userId,
      pattern_type: 'productive_hours',
      pattern_data: { hours: productiveHours },
      confidence_score: 0.7
    });
  }

  // Analyze category preferences
  const categoryCount: { [cat: string]: number } = {};
  tasks.forEach(t => {
    if (t.category) {
      categoryCount[t.category] = (categoryCount[t.category] || 0) + 1;
    }
  });

  const topCategories = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat, count]) => ({ category: cat, count }));

  if (topCategories.length > 0) {
    await supabaseAdmin.from('user_patterns').upsert({
      user_id: userId,
      pattern_type: 'category_preference',
      pattern_data: { preferences: topCategories },
      confidence_score: 0.8
    });
  }
}
