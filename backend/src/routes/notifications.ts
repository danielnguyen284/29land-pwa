import { Router, Response } from "express";
import { AppDataSource } from "../data-source";
import { PushSubscription } from "../entities/PushSubscription";
import { Notification } from "../entities/Notification";
import { authenticate, AuthRequest } from "../middlewares/auth";

const router = Router();
const pushSubRepo = () => AppDataSource.getRepository(PushSubscription);

router.use(authenticate);

// POST /api/notifications/subscribe
router.post("/subscribe", async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint, keys } = req.body;
    const userId = req.user!.id;

    if (!endpoint || !keys) {
      res.status(400).json({ message: "Thiếu thông tin đăng ký (endpoint, keys)" });
      return;
    }

    // Check if exists
    let sub = await pushSubRepo().findOneBy({ user_id: userId, endpoint });
    
    if (sub) {
      // Update keys if needed
      sub.keys = keys;
      await pushSubRepo().save(sub);
      res.json({ message: "Đã cập nhật subscription" });
      return;
    }

    sub = pushSubRepo().create({
      user_id: userId,
      endpoint,
      keys,
    });

    await pushSubRepo().save(sub);
    res.status(201).json({ message: "Đăng ký nhận thông báo thành công" });
  } catch (error) {
    console.error("Subscribe push error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// GET /api/notifications - Get notification history
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notiRepo = AppDataSource.getRepository(Notification);
    
    const notifications = await notiRepo.find({
      where: { user_id: userId },
      order: { created_at: "DESC" },
      take: 50,
    });
    
    res.json(notifications);
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch("/:id/read", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const notiRepo = AppDataSource.getRepository(Notification);
    
    const notification = await notiRepo.findOneBy({ id: id as string, user_id: userId as string });
    
    if (!notification) {
      res.status(404).json({ message: "Không tìm thấy thông báo" });
      return;
    }
    
    notification.is_read = true;
    await notiRepo.save(notification);
    
    res.json({ message: "Đã đánh dấu đã đọc" });
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/notifications/read-all - Mark all as read
router.patch("/read-all", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notiRepo = AppDataSource.getRepository(Notification);
    
    await notiRepo.update({ user_id: userId as string, is_read: false }, { is_read: true });
    
    res.json({ message: "Đã đánh dấu tất cả là đã đọc" });
  } catch (error) {
    console.error("Mark read all error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// GET /api/notifications/vapid-public-key
router.get("/vapid-public-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

export default router;
