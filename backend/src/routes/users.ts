import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../entities/User";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";

const router = Router();
const userRepo = () => AppDataSource.getRepository(User);

// Default auth
router.use(authenticate);

// GET /api/users
router.get("/", requireRole(UserRole.ADMIN, UserRole.OWNER), async (_req: AuthRequest, res: Response) => {
  try {
    const users = await userRepo().find({
      select: ["id", "name", "phone", "email", "role", "payment_qr_code", "created_at"],
      order: { created_at: "DESC" },
    });
    res.json(users);
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// GET /api/users/:id
router.get("/:id", requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const user = await userRepo().findOne({
      where: { id: req.params.id as string },
      select: ["id", "name", "phone", "email", "role", "payment_qr_code", "created_at"],
    });
    if (!user) {
      res.status(404).json({ message: "Không tìm thấy người dùng" });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/users
router.post("/", requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, password, role, payment_qr_code } = req.body;

    if (!name || !phone || !password || !role) {
      res.status(400).json({ message: "Thiếu thông tin bắt buộc (name, phone, password, role)" });
      return;
    }

    const validRoles = [UserRole.OWNER, UserRole.MANAGER, UserRole.TECHNICIAN];
    if (!validRoles.includes(role)) {
      res.status(400).json({ message: "Role không hợp lệ. Chỉ có thể tạo: OWNER, MANAGER, TECHNICIAN" });
      return;
    }

    const existing = await userRepo().findOneBy({ phone });
    if (existing) {
      res.status(409).json({ message: "Số điện thoại đã tồn tại" });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const user = userRepo().create({
      name,
      phone,
      email: email || null,
      password_hash: hash,
      role,
      payment_qr_code: payment_qr_code || null,
    });

    const saved = await userRepo().save(user);

    res.status(201).json({
      id: saved.id,
      name: saved.name,
      phone: saved.phone,
      email: saved.email,
      role: saved.role,
      payment_qr_code: saved.payment_qr_code,
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/users/:id
router.patch("/:id", requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const user = await userRepo().findOneBy({ id: req.params.id as string });
    if (!user) {
      res.status(404).json({ message: "Không tìm thấy người dùng" });
      return;
    }

    const { name, phone, email, password, role, payment_qr_code } = req.body;

    if (name) user.name = name;
    if (phone) {
      const dup = await userRepo().findOneBy({ phone });
      if (dup && dup.id !== user.id) {
        res.status(409).json({ message: "Số điện thoại đã tồn tại" });
        return;
      }
      user.phone = phone;
    }
    if (email !== undefined) user.email = email;
    if (payment_qr_code !== undefined) user.payment_qr_code = payment_qr_code;
    if (password) user.password_hash = await bcrypt.hash(password, 10);
    if (role) {
      const validRoles = [UserRole.OWNER, UserRole.MANAGER, UserRole.TECHNICIAN];
      if (!validRoles.includes(role)) {
        res.status(400).json({ message: "Role không hợp lệ" });
        return;
      }
      user.role = role;
    }

    await userRepo().save(user);

    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      payment_qr_code: user.payment_qr_code,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// DELETE /api/users/:id
router.delete("/:id", requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const user = await userRepo().findOneBy({ id: req.params.id as string });
    if (!user) {
      res.status(404).json({ message: "Không tìm thấy người dùng" });
      return;
    }

    if (user.role === UserRole.ADMIN) {
      res.status(403).json({ message: "Không thể xóa tài khoản Admin" });
      return;
    }

    await userRepo().remove(user);
    res.json({ message: "Đã xóa người dùng" });
  } catch (error: any) {
    console.error("Delete user error:", error);
    
    if (error.code === "23503") {
      res.status(409).json({ message: "Không thể xóa người dùng này vì họ đang có dữ liệu liên kết (sở hữu/quản lý tòa nhà, hợp đồng, hoặc công việc)." });
      return;
    }
    
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

export default router;
