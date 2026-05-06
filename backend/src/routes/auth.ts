import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";
import { authenticate, AuthRequest } from "../middlewares/auth";

const router = Router();
const userRepo = () => AppDataSource.getRepository(User);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";

// POST /api/auth/login
router.post("/login", async (req: AuthRequest, res: Response) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      res.status(400).json({ message: "Vui lòng nhập số điện thoại và mật khẩu" });
      return;
    }

    const user = await userRepo().findOneBy({ phone });
    if (!user) {
      res.status(401).json({ message: "Số điện thoại hoặc mật khẩu không đúng" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ message: "Số điện thoại hoặc mật khẩu không đúng" });
      return;
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await userRepo().findOneBy({ id: req.user!.id });
    if (!user) {
      res.status(404).json({ message: "Không tìm thấy người dùng" });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

export default router;
