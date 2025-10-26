import { supabase } from "@/integrations/supabase/client";

const PUBLIC_VAPID_KEY = "BNXzKVNyQJ7yLo8cZT5uKZj7gKvV9x3HjPXvFhLKKJq-PqWxN4_JGzKv5YfLBHJKJ7yLo8cZT5uKZj7gKvV9x3H";

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

export async function subscribeToPushNotifications(userId: string) {
  try {
    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    // Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      console.error('Failed to register service worker');
      return false;
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });

    console.log('Push subscription:', subscription);

    // Save subscription to database
    const subscriptionJSON = subscription.toJSON();
    
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscriptionJSON.endpoint!,
        p256dh: subscriptionJSON.keys!.p256dh,
        auth: subscriptionJSON.keys!.auth
      }, {
        onConflict: 'user_id,endpoint'
      });

    if (error) {
      console.error('Error saving subscription:', error);
      return false;
    }

    console.log('Push subscription saved to database');
    return true;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return false;
  }
}

export async function unsubscribeFromPushNotifications(userId: string) {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    // Unsubscribe from push
    await subscription.unsubscribe();

    // Remove from database
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint);

    console.log('Unsubscribed from push notifications');
  } catch (error) {
    console.error('Error unsubscribing:', error);
  }
}
