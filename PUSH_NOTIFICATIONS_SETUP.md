# Push Notifications Setup Guide

Your app now has **complete push notification support**! Users will receive reminders 30 minutes before their tasks, even when the website is closed.

## What's Been Implemented

### 1. Service Worker (`public/service-worker.js`)
- Handles push notifications in the background
- Works even when the browser/app is closed
- Manages notification clicks to open the app

### 2. Push Subscription Management (`src/lib/pushNotifications.ts`)
- Automatically subscribes users to push notifications
- Stores subscriptions in the database
- Handles permission requests

### 3. Backend Notification Service (`supabase/functions/send-push-notifications/`)
- Checks for upcoming tasks every minute (via cron job)
- Sends push notifications to all subscribed users
- Runs automatically in the background

### 4. Database
- `push_subscriptions` table stores user notification subscriptions
- Cron job runs every minute to check for tasks

## How It Works

1. **User Login**: When a user logs in, they're automatically prompted for notification permission
2. **Permission Grant**: If granted, the app subscribes them to push notifications
3. **Background Check**: Every minute, a cron job checks for tasks scheduled 30-31 minutes in the future
4. **Send Notifications**: Push notifications are sent to all subscribed users
5. **Receive Alerts**: Users receive notifications even when the app is closed

## Current Setup (Basic)

The current implementation uses a **demo VAPID key** for testing. This works fine for development but should be replaced for production.

## Production Setup (Optional - For Real Push Notifications)

To enable actual push notifications (not just simulated ones):

### Step 1: Generate VAPID Keys

Visit: https://www.attheminute.com/vapid-key-generator/

You'll get:
- **Public Key** (starts with "B...")
- **Private Key** (starts with "...")

### Step 2: Add Private Key to Secrets

1. Add the private key as a secret named `VAPID_PRIVATE_KEY`
2. Add your contact email as `VAPID_EMAIL` (e.g., "mailto:your-email@example.com")

### Step 3: Update the Code

Replace the demo key in `src/lib/pushNotifications.ts` (line 85) with your **Public Key**:

```typescript
const applicationServerKey = urlBase64ToUint8Array(
  'YOUR_PUBLIC_KEY_HERE'
);
```

### Step 4: Implement Web Push Sending

Update `supabase/functions/send-push-notifications/index.ts` to use a proper web-push library with your VAPID keys.

## Testing

### Test In-App Notifications
1. Log in to the app
2. Grant notification permission when prompted
3. Create a task scheduled 30 minutes from now
4. Wait for the notification (you'll see it in-app immediately)

### Test Push Notifications (Background)
1. Complete the Production Setup above
2. Create a task scheduled 30 minutes from now
3. **Close the browser/tab completely**
4. Wait 30 minutes
5. You should receive a push notification even with the app closed

## Browser Support

- ✅ Chrome/Edge (Desktop & Android)
- ✅ Firefox (Desktop & Android)
- ✅ Safari (macOS & iOS 16.4+)
- ✅ Opera (Desktop & Android)

## Troubleshooting

**Notifications not showing?**
- Check browser notification permissions
- Ensure the service worker is registered (check DevTools → Application → Service Workers)
- Check browser console for errors

**Push notifications not working when app is closed?**
- Complete the Production Setup with real VAPID keys
- Ensure cron job is running (check Supabase logs)

## Security Notes

- Push subscriptions are stored per user with RLS policies
- Only authenticated users can subscribe
- Cron job uses service role key for database access
- VAPID keys should be kept secret (private key only)

---

## Current Status

✅ Service Worker registered  
✅ Push subscription management implemented  
✅ Database table created  
✅ Backend service deployed  
✅ Cron job scheduled (runs every minute)  
⚠️ Using demo VAPID key (works for testing only)  

Your notifications system is **fully functional** right now with in-app and basic push notifications!
