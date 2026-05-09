import { Router, Response } from "express";
import { AppDataSource } from "../data-source";
import { TransactionCategory, TransactionType } from "../entities/TransactionCategory";
import { Transaction } from "../entities/Transaction";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";
import { UserRole } from "../entities/User";

const router = Router();
const categoryRepo = () => AppDataSource.getRepository(TransactionCategory);
const transactionRepo = () => AppDataSource.getRepository(Transaction);

router.use(authenticate);

// --- Categories ---

router.get("/categories", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const categories = await categoryRepo().find({ order: { name: "ASC" } });
    res.json(categories);
  } catch (error) {
    console.error("Fetch categories error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

router.post("/categories", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const { name, type } = req.body;
    if (!name || !type) {
      res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
      return;
    }

    const category = categoryRepo().create({
      name,
      type
    });
    await categoryRepo().save(category);
    res.json(category);
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

router.put("/categories/:id", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const { name, type } = req.body;
    const category = await categoryRepo().findOne({ where: { id: req.params.id as string } });
    if (!category) {
      res.status(404).json({ message: "Không tìm thấy danh mục" });
      return;
    }
    if (name) category.name = name;
    if (type) category.type = type;
    await categoryRepo().save(category);
    res.json(category);
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

router.delete("/categories/:id", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const category = await categoryRepo().findOne({ where: { id: req.params.id as string } });
    if (!category) {
      res.status(404).json({ message: "Không tìm thấy danh mục" });
      return;
    }
    
    // Check if used
    const count = await transactionRepo().count({ where: { category_id: category.id } });
    if (count > 0) {
      res.status(400).json({ message: "Không thể xóa danh mục đang có giao dịch" });
      return;
    }

    await categoryRepo().remove(category);
    res.json({ message: "Đã xóa danh mục" });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// --- Transactions ---

router.get("/", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const { building_id, period } = req.query;
    const where: any = {};
    if (building_id) {
      where.building_id = building_id;
    }
    if (period) {
      where.accounting_period = period;
    }

    const transactions = await transactionRepo().find({
      where,
      relations: ["category", "creator", "room", "building"],
      order: { created_at: "DESC" },
    });

    res.json(transactions);
  } catch (error) {
    console.error("Fetch transactions error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

router.post("/", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const { building_id, room_id, category_id, amount, type, accounting_period, description, invoice_photos, product_photos } = req.body;
    
    if (!building_id || amount === undefined || !type || !accounting_period) {
      res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
      return;
    }

    const transaction = transactionRepo().create({
      building_id,
      room_id: room_id || null,
      category_id,
      amount,
      type,
      accounting_period,
      description,
      invoice_photos: invoice_photos || [],
      product_photos: product_photos || [],
      created_by: req.user!.id
    });

    await transactionRepo().save(transaction);
    res.json(transaction);
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

router.put("/:id", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const { room_id, category_id, amount, type, accounting_period, description, invoice_photos, product_photos } = req.body;
    const transaction = await transactionRepo().findOne({ where: { id: req.params.id as string } });
    
    if (!transaction) {
      res.status(404).json({ message: "Không tìm thấy giao dịch" });
      return;
    }

    if (room_id !== undefined) transaction.room_id = room_id || null;
    if (category_id !== undefined) transaction.category_id = category_id || null;
    if (amount !== undefined) transaction.amount = amount;
    if (type) transaction.type = type;
    if (accounting_period) transaction.accounting_period = accounting_period;
    if (description !== undefined) transaction.description = description;
    if (invoice_photos) transaction.invoice_photos = invoice_photos;
    if (product_photos) transaction.product_photos = product_photos;

    await transactionRepo().save(transaction);
    res.json(transaction);
  } catch (error) {
    console.error("Update transaction error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

router.delete("/:id", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const transaction = await transactionRepo().findOne({ where: { id: req.params.id as string } });
    if (!transaction) {
      res.status(404).json({ message: "Không tìm thấy giao dịch" });
      return;
    }
    await transactionRepo().remove(transaction);
    res.json({ message: "Đã xóa giao dịch" });
  } catch (error) {
    console.error("Delete transaction error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

export default router;
