/**
 * Web Push notification service.
 * 
 * For now this is a placeholder that logs notifications.
 * To enable real push notifications, install `web-push` and configure VAPID keys:
 *   npm install web-push
 *   Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL to .env
 * 
 * The frontend will need to register a service worker and subscribe to push.
 * Subscription endpoints will be stored in a push_subscriptions table.
 */

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification(
  _userId: string,
  payload: PushPayload
): Promise<void> {
  // TODO: Implement with web-push library when VAPID keys are configured
  console.log(`[PUSH] To user ${_userId}:`, payload.title, "-", payload.body);
}
