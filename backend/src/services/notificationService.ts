import { AppDataSource } from "../data-source";
import { Notification, NotificationType } from "../entities/Notification";
import { sendPushNotification } from "./webpush";

export async function createNotification(
  userId: string,
  title: string,
  content: string,
  type: NotificationType,
  data?: any
) {
  try {
    const notiRepo = AppDataSource.getRepository(Notification);
    const noti = notiRepo.create({
      user_id: userId,
      title,
      content,
      type,
      data,
    });
    await notiRepo.save(noti);

    // Also send push notification
    await sendPushNotification(userId, {
      title,
      body: content,
      url: data?.url || (data?.ticket_id ? `/tickets/${data.ticket_id}` : undefined),
    });
    
    return noti;
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}
