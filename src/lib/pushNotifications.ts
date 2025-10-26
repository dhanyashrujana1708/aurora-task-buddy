import { supabase } from "@/integrations/supabase/client";

// Convert base64 string to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
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

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
    console.log('Service Worker registered successfully:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

export async function subscribeToPushNotifications(userId: string): Promise<boolean> {
  try {
    // Check if push notifications are supported
    if (!('PushManager' in window)) {
      console.log('Push notifications not supported');
      return false;
    }

    // Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      return false;
    }

    // Request notification permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.log('Notification permission not granted');
      return false;
    }

    // Wait for service worker to be ready
    const serviceWorkerRegistration = await navigator.serviceWorker.ready;

    // For now, we'll use a simple application server key
    // In production, you should use proper VAPID keys
    // Generate VAPID keys at: https://www.attheminute.com/vapid-key-generator/
    const applicationServerKey = urlBase64ToUint8Array(
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
    );

    // Subscribe to push notifications
    const subscription = await serviceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource
    });

    // Get subscription details
    const subscriptionJSON = subscription.toJSON();
    
    if (!subscriptionJSON.endpoint || !subscriptionJSON.keys) {
      console.error('Invalid subscription object');
      return false;
    }

    // Save subscription to database
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscriptionJSON.endpoint,
        p256dh: subscriptionJSON.keys.p256dh || '',
        auth: subscriptionJSON.keys.auth || ''
      }, {
        onConflict: 'user_id,endpoint'
      });

    if (error) {
      console.error('Error saving push subscription:', error);
      return false;
    }

    console.log('Successfully subscribed to push notifications');
    return true;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return false;
  }
}

export async function unsubscribeFromPushNotifications(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const subscriptionJSON = subscription.toJSON();
      
      // Remove from database
      if (subscriptionJSON.endpoint) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', subscriptionJSON.endpoint);
      }

      // Unsubscribe from push service
      await subscription.unsubscribe();
      console.log('Unsubscribed from push notifications');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}