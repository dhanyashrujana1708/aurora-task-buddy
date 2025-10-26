import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { subscribeToPushNotifications } from "@/utils/pushNotifications";

interface Task {
  id: string;
  title: string;
  scheduled_date: string;
  completed: boolean;
}

export const useTaskReminders = (userId: string | undefined) => {
  const notifiedTasksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    // Request notification permission and subscribe to push
    const setupNotifications = async () => {
      if ("Notification" in window && Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          // Subscribe to push notifications
          const subscribed = await subscribeToPushNotifications(userId);
          if (subscribed) {
            toast.success("Push notifications enabled! You'll get reminders even when the site is closed.");
          } else {
            toast.success("Task reminders enabled! You'll get notifications 30 minutes before tasks.");
          }
        } else if (permission === "denied") {
          toast.info("Enable notifications in your browser settings to get task reminders.");
        }
      } else if (Notification.permission === "granted") {
        // Already has permission, just subscribe to push
        await subscribeToPushNotifications(userId);
      }
    };

    setupNotifications();

    // Check for upcoming tasks every minute
    const checkUpcomingTasks = async () => {
      try {
        const now = new Date();
        const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
        const thirtyOneMinutesFromNow = new Date(now.getTime() + 31 * 60 * 1000);

        // Fetch tasks scheduled between 30-31 minutes from now
        const { data: tasks, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", userId)
          .eq("completed", false)
          .gte("scheduled_date", thirtyMinutesFromNow.toISOString())
          .lt("scheduled_date", thirtyOneMinutesFromNow.toISOString());

        if (error) throw error;

        if (tasks && tasks.length > 0) {
          tasks.forEach((task: Task) => {
            // Check if we've already notified about this task
            if (!notifiedTasksRef.current.has(task.id)) {
              sendNotification(task);
              notifiedTasksRef.current.add(task.id);
            }
          });
        }
      } catch (error) {
        console.error("Error checking upcoming tasks:", error);
      }
    };

    const sendNotification = (task: Task) => {
      const scheduledDate = new Date(task.scheduled_date);
      
      // Convert to IST for display
      const istDate = new Date(scheduledDate.getTime() + (5.5 * 60 * 60 * 1000));
      const timeString = istDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      });

      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification("Upcoming Task Reminder", {
          body: `"${task.title}" starts in 30 minutes at ${timeString}`,
          icon: "/favicon.ico",
          tag: task.id,
          requireInteraction: false,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }

      // Also show a toast notification
      toast.info(`Reminder: "${task.title}" starts in 30 minutes at ${timeString}`, {
        duration: 10000,
      });
    };

    // Check immediately on mount
    checkUpcomingTasks();

    // Then check every minute
    const interval = setInterval(checkUpcomingTasks, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [userId]);

  // Clean up old notifications when tasks are completed
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('task-completion')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          if (payload.new.completed) {
            // Remove from notified set if task is completed
            notifiedTasksRef.current.delete(payload.new.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
};