import { Router, Response } from "express";
import { AppDataSource } from "../data-source";
import { In } from "typeorm";
import { Ticket, TicketStatus, TicketPriority } from "../entities/Ticket";
import { TicketExpense, ExpenseStatus } from "../entities/TicketExpense";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";
import { UserRole } from "../entities/User";
import { createNotification } from "../services/notificationService";
import { NotificationType } from "../entities/Notification";
import { requireTicketAccess, requireExpenseAccess } from "../middlewares/accessControl";

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
      .leftJoinAndSelect("t.building", "building")
      .leftJoinAndSelect("t.room", "room")
      .leftJoinAndSelect("t.creator", "creator")
      .leftJoinAndSelect("t.expenses", "expenses")
      .leftJoinAndSelect("t.assigned_tech", "tech");

    const { role, id } = req.user!;

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
      qb.andWhere("t.building_id IN (:...buildingIds)", { buildingIds });
    }

    if (req.query.building_id && req.query.building_id !== "ALL") {
      qb.andWhere("t.building_id = :bId", { bId: req.query.building_id });
    }
    if (req.query.room_id) qb.andWhere("t.room_id = :roomId", { roomId: req.query.room_id });
    if (req.query.status && req.query.status !== "ALL") qb.andWhere("t.status = :status", { status: req.query.status });
    if (req.query.priority) qb.andWhere("t.priority = :priority", { priority: req.query.priority });
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
router.get("/:id", requireTicketAccess, async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await ticketRepo().findOne({
      where: { id: req.params.id as string },
      relations: ["building", "room", "creator", "assigned_tech"],
    });
    // ticket is guaranteed by requireTicketAccess
    
    const expenses = await expenseRepo().find({
      where: { ticket_id: ticket!.id },
      order: { created_at: "DESC" },
    });

    res.json({ ...ticket!, expenses });
  } catch (error) {
    console.error("Get ticket error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/tickets (Manager creates)
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { building_id, room_id, assigned_tech_id, title, description, priority, evidence_photos } = req.body;
    if (!building_id || !title) {
      res.status(400).json({ message: "building_id và title là bắt buộc" });
      return;
    }

    const ticket = ticketRepo().create({
      building_id,
      room_id: room_id || null,
      assigned_tech_id: assigned_tech_id || null,
      title,
      description: description || null,
      created_by: req.user!.id,
      priority: priority || TicketPriority.MEDIUM,
      evidence_photos: evidence_photos || [],
      status: assigned_tech_id ? TicketStatus.IN_PROGRESS : TicketStatus.PENDING,
    });

    const saved = await ticketRepo().save(ticket);

    // Notify technician
    if (assigned_tech_id) {
      await createNotification(
        assigned_tech_id,
        "Công việc mới được gán",
        `Bạn có công việc mới: ${title}`,
        NotificationType.TICKET_ASSIGNED,
        { ticket_id: saved.id }
      );
    }

    res.status(201).json(saved);
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/tickets/:id (assign tech, update status)
router.patch("/:id", requireTicketAccess, async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await ticketRepo().findOneBy({ id: req.params.id as string });
    
    const { role, id } = req.user!;
    const { assigned_tech_id, status, title, description, evidence_photos, priority } = req.body;

    if (role === UserRole.TECHNICIAN) {
      if (title !== undefined || description !== undefined || assigned_tech_id !== undefined || priority !== undefined) {
        res.status(403).json({ message: "Kỹ thuật viên không có quyền sửa thông tin phiếu" });
        return;
      }
    }

    if (title !== undefined) ticket!.title = title;
    if (description !== undefined) ticket!.description = description;
    if (evidence_photos !== undefined) ticket!.evidence_photos = evidence_photos;
    if (priority !== undefined) ticket!.priority = priority;

    if (assigned_tech_id !== undefined) {
      ticket!.assigned_tech_id = assigned_tech_id;
      if (assigned_tech_id && ticket!.status === TicketStatus.PENDING) {
        ticket!.status = TicketStatus.IN_PROGRESS;
      }
      if (assigned_tech_id) {
        await createNotification(
          assigned_tech_id,
          "Công việc được gán",
          `Bạn được gán công việc: ${ticket!.title}`,
          NotificationType.TICKET_ASSIGNED,
          { ticket_id: ticket!.id }
        );
      }
    }

    if (status !== undefined) {
      if (status === TicketStatus.COMPLETED) {
        const unapprovedCount = await expenseRepo().count({
          where: {
            ticket_id: ticket!.id,
            status: In([ExpenseStatus.PENDING, ExpenseStatus.REJECTED]),
          }
        });
        if (unapprovedCount > 0) {
          res.status(400).json({ message: "Không thể hoàn thành phiếu khi vẫn còn chi phí chưa được duyệt." });
          return;
        }
      }
      ticket!.status = status;
    }

    await ticketRepo().save(ticket!);
    res.json(ticket);
  } catch (error) {
    console.error("Update ticket error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// ─── Ticket Expenses ───

// POST /api/tickets/:id/expenses (Technician submits expense)
router.post("/:id/expenses", requireTicketAccess, requireRole(UserRole.TECHNICIAN, UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await ticketRepo().findOneBy({ id: req.params.id as string });

    const { amount, description, receipt_photos } = req.body;
    if (!amount) { res.status(400).json({ message: "Số tiền là bắt buộc" }); return; }

    const expense = expenseRepo().create({
      ticket_id: ticket!.id,
      amount,
      description: description || null,
      receipt_photos: receipt_photos || [],
      status: ExpenseStatus.PENDING,
      created_by: req.user!.id
    });

    const saved = await expenseRepo().save(expense);
    res.status(201).json(saved);
  } catch (error) {
    console.error("Create expense error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/tickets/expenses/:expenseId (Update expense before approval)
router.patch("/expenses/:expenseId", requireExpenseAccess, requireRole(UserRole.TECHNICIAN, UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const expense = await expenseRepo().findOneBy({ id: req.params.expenseId as string });

    if (expense!.status === ExpenseStatus.APPROVED) {
      res.status(400).json({ message: "Không thể sửa khoản chi đã được duyệt" });
      return;
    }

    const { amount, description, receipt_photos } = req.body;
    if (amount !== undefined) expense!.amount = amount;
    if (description !== undefined) expense!.description = description;
    if (receipt_photos !== undefined) expense!.receipt_photos = receipt_photos;

    const saved = await expenseRepo().save(expense!);
    res.json(saved);
  } catch (error) {
    console.error("Update expense error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/tickets/expenses/:expenseId/approve (Owner approves/rejects)
router.patch("/expenses/:expenseId/approve", requireExpenseAccess, requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.user!;
    const expense = await expenseRepo().findOne({
      where: { id: req.params.expenseId as string },
      relations: ["ticket"],
    });

    const { approved, reject_reason } = req.body;

    if (approved) {
      expense!.status = ExpenseStatus.APPROVED;
      expense!.approved_at = new Date();
      expense!.approved_by = id;
      expense!.reject_reason = "";
    } else {
      expense!.status = ExpenseStatus.REJECTED;
      if (reject_reason) expense!.reject_reason = reject_reason;
      
      await ticketRepo().update(expense!.ticket_id, {
        status: TicketStatus.NEEDS_EXPLANATION,
      });

      if (expense!.ticket.assigned_tech_id) {
        await createNotification(
          expense!.ticket.assigned_tech_id,
          "Chi phí bị từ chối",
          `Chi phí cho công việc "${expense!.ticket.title}" đã bị từ chối.`,
          NotificationType.TICKET_UPDATED,
          { ticket_id: expense!.ticket_id }
        );
      }
    }

    await expenseRepo().save(expense!);

    // Auto-complete ticket if all expenses are approved
    if (approved) {
      const remaining = await expenseRepo().count({
        where: { 
          ticket_id: expense!.ticket_id, 
          status: In([ExpenseStatus.PENDING, ExpenseStatus.REJECTED]) 
        }
      });
      if (remaining === 0) {
        expense!.ticket.status = TicketStatus.COMPLETED;
        await ticketRepo().save(expense!.ticket);
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
      await createNotification(
        ticket.assigned_tech_id,
        "Chi phí được duyệt",
        `Tất cả chi phí cho công việc "${ticket.title}" đã được duyệt.`,
        NotificationType.TICKET_UPDATED,
        { ticket_id: ticketId }
      );
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
router.patch("/expenses/:expenseId/resubmit", requireExpenseAccess, requireRole(UserRole.TECHNICIAN, UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const expense = await expenseRepo().findOne({
      where: { id: req.params.expenseId as string },
      relations: ["ticket"],
    });
    // expense is guaranteed by requireExpenseAccess

    if (expense!.status !== ExpenseStatus.REJECTED) {
      res.status(400).json({ message: "Chỉ có thể nộp lại các khoản chi bị từ chối" });
      return;
    }

    const { amount, description, receipt_photos, technician_comment } = req.body;

    if (amount) expense!.amount = amount;
    if (description !== undefined) expense!.description = description;
    if (receipt_photos) expense!.receipt_photos = receipt_photos;
    if (technician_comment) expense!.technician_comment = technician_comment;
    
    expense!.status = ExpenseStatus.PENDING;

    await expenseRepo().save(expense!);

    if (expense!.ticket.status === TicketStatus.NEEDS_EXPLANATION) {
      await ticketRepo().update(expense!.ticket_id, {
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
