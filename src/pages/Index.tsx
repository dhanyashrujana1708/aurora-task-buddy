import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Auth } from "@/components/Auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskList } from "@/components/TaskList";
import { WeatherWidget } from "@/components/WeatherWidget";
import { WeatherRescheduler } from "@/components/WeatherRescheduler";
import { MotivationQuote } from "@/components/MotivationQuote";
import { ChatBot } from "@/components/ChatBot";
import { NotionSettings } from "@/components/NotionSettings";
import { Button } from "@/components/ui/button";
import { useTaskReminders } from "@/hooks/useTaskReminders";
import { Settings, LogOut } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { addDays, startOfDay, endOfDay, format } from "date-fns";

const Index = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [todayTasks, setTodayTasks] = useState([]);
  const [tomorrowTasks, setTomorrowTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notionApiKey, setNotionApiKey] = useState<string | null>(null);
  const [notionDatabaseId, setNotionDatabaseId] = useState<string | null>(null);

  // Enable task reminders
  useTaskReminders(session?.user?.id);

  useEffect(() => {
    console.log("Index component mounted");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Session fetched:", session);
      setSession(session);
      setLoading(false);
    }).catch(error => {
      console.error("Error getting session:", error);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed:", session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchTasks();
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("notifications_enabled, notion_api_key, notion_database_id")
        .eq("id", session?.user?.id)
        .single();

      if (error) throw error;
      if (data) {
        setNotificationsEnabled(data.notifications_enabled);
        setNotionApiKey(data.notion_api_key);
        setNotionDatabaseId(data.notion_database_id);
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      const today = new Date();
      const tomorrow = addDays(today, 1);

      const { data: todayData, error: todayError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", session?.user?.id)
        .gte("scheduled_date", startOfDay(today).toISOString())
        .lte("scheduled_date", endOfDay(today).toISOString())
        .order("scheduled_date", { ascending: true });

      const { data: tomorrowData, error: tomorrowError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", session?.user?.id)
        .gte("scheduled_date", startOfDay(tomorrow).toISOString())
        .lte("scheduled_date", endOfDay(tomorrow).toISOString())
        .order("scheduled_date", { ascending: true });

      const { data: allData, error: allError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", session?.user?.id)
        .order("scheduled_date", { ascending: true });

      if (todayError) throw todayError;
      if (tomorrowError) throw tomorrowError;
      if (allError) throw allError;

      setTodayTasks(todayData || []);
      setTomorrowTasks(tomorrowData || []);
      setAllTasks(allData || []);
    } catch (error: any) {
      toast.error("Error fetching tasks");
      console.error(error);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notifications_enabled: enabled })
        .eq("id", session?.user?.id);

      if (error) throw error;
      setNotificationsEnabled(enabled);
      toast.success(
        enabled ? "Notifications enabled" : "Notifications disabled"
      );
    } catch (error: any) {
      toast.error("Error updating settings");
      console.error(error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
  };

  console.log("Render - loading:", loading, "session:", session);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-pulse text-2xl font-bold text-primary mb-2">Loading...</div>
          <p className="text-muted-foreground">Initializing Aurora Task Planner</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Aurora Task Planner
            </h1>
            <p className="text-muted-foreground mt-1">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="aurora-card">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="aurora-card max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                  <DialogDescription>
                    Manage your preferences and integrations
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Preferences</h3>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notifications">Task Reminders</Label>
                      <Switch
                        id="notifications"
                        checked={notificationsEnabled}
                        onCheckedChange={handleNotificationToggle}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-sm font-semibold mb-3">Notion Integration</h3>
                    <NotionSettings
                      userId={session?.user?.id}
                      notionApiKey={notionApiKey}
                      notionDatabaseId={notionDatabaseId}
                      onUpdate={() => {
                        fetchProfile();
                        fetchTasks();
                      }}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="icon"
              onClick={handleSignOut}
              className="aurora-card"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Top Section */}
        <div className="grid md:grid-cols-2 gap-6">
          <MotivationQuote />
          <WeatherWidget />
        </div>

        {/* Weather Rescheduler Alert */}
        <WeatherRescheduler onReschedule={fetchTasks} />

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tasks Section */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="today" className="w-full">
              <TabsList className="grid w-full grid-cols-3 aurora-card">
                <TabsTrigger value="today">Today's Tasks</TabsTrigger>
                <TabsTrigger value="tomorrow">Tomorrow's Tasks</TabsTrigger>
                <TabsTrigger value="all">All Tasks</TabsTrigger>
              </TabsList>
              <TabsContent value="today" className="mt-6">
                <TaskList tasks={todayTasks} onTaskUpdate={fetchTasks} />
              </TabsContent>
              <TabsContent value="tomorrow" className="mt-6">
                <TaskList tasks={tomorrowTasks} onTaskUpdate={fetchTasks} />
              </TabsContent>
              <TabsContent value="all" className="mt-6">
                <TaskList tasks={allTasks} onTaskUpdate={fetchTasks} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Chatbot Section */}
          <div>
            <ChatBot onTaskUpdate={fetchTasks} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
