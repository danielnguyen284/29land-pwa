import { Router, Response } from "express";
import { AppDataSource } from "../data-source";
import { PushSubscription } from "../entities/PushSubscription";
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

// GET /api/notifications/vapid-public-key
router.get("/vapid-public-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

export default router;
