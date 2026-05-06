import webpush from "web-push";
import { AppDataSource } from "../data-source";
import { PushSubscription } from "../entities/PushSubscription";

// Cấu hình VAPID
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || "admin@29land.local"}`,
  process.env.VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<void> {
  try {
    const pushSubRepo = AppDataSource.getRepository(PushSubscription);
    const subscriptions = await pushSubRepo.find({ where: { user_id: userId } });

    if (subscriptions.length === 0) {
      console.log(`[PUSH] User ${userId} has no active push subscriptions.`);
      return;
    }

    const payloadString = JSON.stringify(payload);

    const notifications = subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payloadString
      ).catch(async (error) => {
        console.error(`[PUSH] Failed to send to endpoint ${sub.endpoint}:`, error);
        if (error.statusCode === 410 || error.statusCode === 404) {
          // Subscription expired or no longer valid, remove it
          await pushSubRepo.remove(sub);
          console.log(`[PUSH] Removed expired subscription for user ${userId}`);
        }
      })
    );

    await Promise.all(notifications);
    console.log(`[PUSH] Sent ${subscriptions.length} notifications to user ${userId}`);
  } catch (error) {
    console.error("[PUSH] Error sending push notification:", error);
  }
}
