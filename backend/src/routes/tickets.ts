import { Router, Response } from "express";
import { AppDataSource } from "../data-source";
import { In } from "typeorm";
import { Ticket, TicketStatus } from "../entities/Ticket";
import { TicketExpense, ExpenseStatus } from "../entities/TicketExpense";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";
import { UserRole } from "../entities/User";
import { sendPushNotification } from "../services/webpush";

const router = Router();
const ticketRepo = () => AppDataSource.getRepository(Ticket);
const expenseRepo = () => AppDataSource.getRepository(TicketExpense);

router.use(authenticate);

// ─── Tickets ───

// GET /api/tickets?room_id=&status=&assigned_tech_id=&page=&limit=
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;

    const qb = ticketRepo()
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.room", "room")
      .leftJoinAndSelect("t.creator", "creator")
      .leftJoinAndSelect("t.expenses", "expenses")
      .leftJoinAndSelect("t.assigned_tech", "tech");

    const { role, id } = req.user!;

    // Join floor and building for RBAC and filtering
    qb.leftJoin("room.floor", "floor");
    qb.leftJoin("floor.building", "building");

    if (role === UserRole.TECHNICIAN) {
      qb.andWhere("t.assigned_tech_id = :techId", { techId: id });
    } else if (role === UserRole.OWNER) {
      qb.andWhere("building.owner_id = :ownerId", { ownerId: id });
      qb.andWhere("t.status IN (:...visibleStatuses)", { visibleStatuses: [TicketStatus.WAITING_APPROVAL, TicketStatus.COMPLETED, TicketStatus.NEEDS_EXPLANATION] });
    } else if (role === UserRole.MANAGER) {
      const managerRepo = AppDataSource.getRepository("BuildingManager");
      const assignments = await managerRepo.find({ where: { manager_id: id } });
      const buildingIds = assignments.map((a: any) => a.building_id);
      if (buildingIds.length === 0) {
        res.json({ data: [], meta: { total: 0, page, limit, totalPages: 0 } });
        return;
      }
      qb.andWhere("floor.building_id IN (:...buildingIds)", { buildingIds });
    }

    if (req.query.building_id) {
      qb.andWhere("floor.building_id = :buildingId", { buildingId: req.query.building_id });
    }
    if (req.query.room_id) qb.andWhere("t.room_id = :roomId", { roomId: req.query.room_id });
    if (req.query.status) qb.andWhere("t.status = :status", { status: req.query.status });
    if (req.query.assigned_tech_id) qb.andWhere("t.assigned_tech_id = :tid", { tid: req.query.assigned_tech_id });

    qb.orderBy("t.created_at", "DESC");
    qb.skip(skip).take(limit);

    const [tickets, total] = await qb.getManyAndCount();
    
    res.json({
      data: tickets,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("List tickets error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// GET /api/tickets/:id
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await ticketRepo().findOne({
      where: { id: req.params.id as string },
      relations: ["room", "creator", "assigned_tech"],
    });
    if (!ticket) { res.status(404).json({ message: "Không tìm thấy phiếu sửa chữa" }); return; }

    const expenses = await expenseRepo().find({
      where: { ticket_id: ticket.id },
      order: { created_at: "DESC" },
    });

    res.json({ ...ticket, expenses });
  } catch (error) {
    console.error("Get ticket error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/tickets (Manager creates)
router.post("/", requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const { room_id, title, description, assigned_tech_id } = req.body;
    if (!room_id || !title) {
      res.status(400).json({ message: "room_id và title là bắt buộc" });
      return;
    }

    const ticket = ticketRepo().create({
      room_id,
      title,
      description: description || null,
      created_by: req.user!.id,
      assigned_tech_id: assigned_tech_id || null,
      status: assigned_tech_id ? TicketStatus.IN_PROGRESS : TicketStatus.PENDING,
    });

    const saved = await ticketRepo().save(ticket);

    // Push notification to technician
    if (assigned_tech_id) {
      await sendPushNotification(assigned_tech_id, {
        title: "Phiếu sửa chữa mới",
        body: `${title} — cần xử lý`,
        url: `/tickets/${saved.id}`,
      });
    }

    res.status(201).json(saved);
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/tickets/:id (assign tech, update status)
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await ticketRepo().findOneBy({ id: req.params.id as string });
    if (!ticket) { res.status(404).json({ message: "Không tìm thấy phiếu sửa chữa" }); return; }

    const { assigned_tech_id, status, title, description } = req.body;

    if (title !== undefined) ticket.title = title;
    if (description !== undefined) ticket.description = description;

    if (assigned_tech_id !== undefined) {
      ticket.assigned_tech_id = assigned_tech_id;
      if (assigned_tech_id && ticket.status === TicketStatus.PENDING) {
        ticket.status = TicketStatus.IN_PROGRESS;
      }
      // Notify new tech
      if (assigned_tech_id) {
        await sendPushNotification(assigned_tech_id, {
          title: "Phiếu sửa chữa được gán",
          body: `${ticket.title}`,
          url: `/tickets/${ticket.id}`,
        });
      }
    }

    if (status !== undefined) {
      if (status === TicketStatus.COMPLETED) {
        const unapprovedCount = await expenseRepo().count({
          where: {
            ticket_id: ticket.id,
            status: In([ExpenseStatus.PENDING, ExpenseStatus.REJECTED]),
          }
        });
        if (unapprovedCount > 0) {
          res.status(400).json({ message: "Không thể hoàn thành phiếu khi vẫn còn chi phí chưa được duyệt." });
          return;
        }
      }
      ticket.status = status;
    }

    await ticketRepo().save(ticket);
    res.json(ticket);
  } catch (error) {
    console.error("Update ticket error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// ─── Ticket Expenses ───

// POST /api/tickets/:id/expenses (Technician submits expense)
router.post("/:id/expenses", requireRole(UserRole.TECHNICIAN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await ticketRepo().findOneBy({ id: req.params.id as string });
    if (!ticket) { res.status(404).json({ message: "Không tìm thấy phiếu sửa chữa" }); return; }

    const { amount, description, receipt_photos } = req.body;
    if (!amount) { res.status(400).json({ message: "Số tiền là bắt buộc" }); return; }

    const expense = expenseRepo().create({
      ticket_id: ticket.id,
      amount,
      description: description || null,
      receipt_photos: receipt_photos || [],
      status: ExpenseStatus.PENDING,
    });

    const saved = await expenseRepo().save(expense);
    res.status(201).json(saved);
  } catch (error) {
    console.error("Create expense error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/tickets/expenses/:expenseId (Update expense before approval)
router.patch("/expenses/:expenseId", requireRole(UserRole.TECHNICIAN, UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const expense = await expenseRepo().findOneBy({ id: req.params.expenseId as string });
    if (!expense) { res.status(404).json({ message: "Không tìm thấy khoản chi" }); return; }

    if (expense.status === ExpenseStatus.APPROVED) {
      res.status(400).json({ message: "Không thể sửa khoản chi đã được duyệt" });
      return;
    }

    const { amount, description, receipt_photos } = req.body;
    if (amount !== undefined) expense.amount = amount;
    if (description !== undefined) expense.description = description;
    if (receipt_photos !== undefined) expense.receipt_photos = receipt_photos;

    const saved = await expenseRepo().save(expense);
    res.json(saved);
  } catch (error) {
    console.error("Update expense error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/tickets/expenses/:expenseId/approve (Owner approves/rejects)
router.patch("/expenses/:expenseId/approve", requireRole(UserRole.ADMIN, UserRole.OWNER), async (req: AuthRequest, res: Response) => {
  try {
    const expense = await expenseRepo().findOne({
      where: { id: req.params.expenseId as string },
      relations: ["ticket"],
    });
    if (!expense) { res.status(404).json({ message: "Không tìm thấy khoản chi" }); return; }

    const { approved, reject_reason } = req.body; // boolean, string

    if (approved) {
      expense.status = ExpenseStatus.APPROVED;
      expense.reject_reason = "";
    } else {
      expense.status = ExpenseStatus.REJECTED;
      if (reject_reason) expense.reject_reason = reject_reason;
      
      // Set parent ticket to NEEDS_EXPLANATION
      await ticketRepo().update(expense.ticket_id, {
        status: TicketStatus.NEEDS_EXPLANATION,
      });

      // Send push notification to technician
      if (expense.ticket.assigned_tech_id) {
        await sendPushNotification(expense.ticket.assigned_tech_id, {
          title: "Chi phí bị từ chối",
          body: `Chi phí cho phiếu "${expense.ticket.title}" đã bị từ chối.`,
          url: `/tickets/${expense.ticket.id}`,
        });
      }
    }

    await expenseRepo().save(expense);

    // Auto-complete ticket if all expenses are approved
    if (approved) {
      const remaining = await expenseRepo().count({
        where: { ticket_id: expense.ticket_id, status: In([ExpenseStatus.PENDING, ExpenseStatus.REJECTED]) }
      });
      if (remaining === 0) {
        expense.ticket.status = TicketStatus.COMPLETED;
        await ticketRepo().save(expense.ticket);
      }
    }

    res.json(expense);
  } catch (error) {
    console.error("Approve expense error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/tickets/:id/expenses/approve-all (Owner/Admin approves all pending expenses)
router.post("/:id/expenses/approve-all", requireRole(UserRole.OWNER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = req.params.id as string;
    const ticket = await ticketRepo().findOne({ where: { id: ticketId } });
    if (!ticket) { res.status(404).json({ message: "Không tìm thấy phiếu" }); return; }

    const expenses = await expenseRepo().find({ where: { ticket_id: ticketId, status: ExpenseStatus.PENDING } });
    if (expenses.length === 0) {
      res.status(400).json({ message: "Không có khoản chi chờ duyệt" });
      return;
    }

    for (const exp of expenses) {
      exp.status = ExpenseStatus.APPROVED;
      await expenseRepo().save(exp);
    }

    if (ticket.assigned_tech_id) {
      await sendPushNotification(ticket.assigned_tech_id, {
        title: "Chi phí được duyệt",
        body: `Tất cả chi phí cho phiếu "${ticket.title}" đã được duyệt.`,
        url: `/tickets/${ticket.id}`,
      });
    }

    // Auto-complete ticket
    const remaining = await expenseRepo().count({
      where: { ticket_id: ticketId, status: ExpenseStatus.REJECTED }
    });
    if (remaining === 0) {
      ticket.status = TicketStatus.COMPLETED;
      await ticketRepo().save(ticket);
    }

    res.json({ message: "Đã duyệt tất cả khoản chi" });
  } catch (error) {
    console.error("Approve all expenses error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/tickets/expenses/:expenseId/resubmit (Technician resubmits rejected expense)
router.patch("/expenses/:expenseId/resubmit", requireRole(UserRole.TECHNICIAN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const expense = await expenseRepo().findOne({
      where: { id: req.params.expenseId as string },
      relations: ["ticket"],
    });
    if (!expense) { res.status(404).json({ message: "Không tìm thấy khoản chi" }); return; }

    if (expense.status !== ExpenseStatus.REJECTED) {
      res.status(400).json({ message: "Chỉ có thể nộp lại các khoản chi bị từ chối" });
      return;
    }

    const { amount, description, receipt_photos, technician_comment } = req.body;

    if (amount) expense.amount = amount;
    if (description !== undefined) expense.description = description;
    if (receipt_photos) expense.receipt_photos = receipt_photos;
    if (technician_comment) expense.technician_comment = technician_comment;
    
    expense.status = ExpenseStatus.PENDING;

    await expenseRepo().save(expense);

    if (expense.ticket.status === TicketStatus.NEEDS_EXPLANATION) {
      await ticketRepo().update(expense.ticket_id, {
        status: TicketStatus.IN_PROGRESS,
      });
    }

    res.json(expense);
  } catch (error) {
    console.error("Resubmit expense error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

export default router;
