import { Router, Response } from "express";
import { AppDataSource } from "../data-source";
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

// GET /api/tickets?room_id=&status=&assigned_tech_id=
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const qb = ticketRepo()
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.room", "room")
      .leftJoinAndSelect("t.creator", "creator")
      .leftJoinAndSelect("t.assigned_tech", "tech");

    const { role, id } = req.user!;

    // Technicians only see their assigned tickets
    if (role === UserRole.TECHNICIAN) {
      qb.andWhere("t.assigned_tech_id = :techId", { techId: id });
    }

    if (req.query.room_id) qb.andWhere("t.room_id = :roomId", { roomId: req.query.room_id });
    if (req.query.status) qb.andWhere("t.status = :status", { status: req.query.status });
    if (req.query.assigned_tech_id) qb.andWhere("t.assigned_tech_id = :tid", { tid: req.query.assigned_tech_id });

    qb.orderBy("t.created_at", "DESC");

    const tickets = await qb.getMany();
    res.json(tickets);
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

    if (status !== undefined) ticket.status = status;

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

// PATCH /api/ticket-expenses/:expenseId/approve (Owner approves/rejects)
router.patch("/expenses/:expenseId/approve", requireRole(UserRole.ADMIN, UserRole.OWNER), async (req: AuthRequest, res: Response) => {
  try {
    const expense = await expenseRepo().findOne({
      where: { id: req.params.expenseId as string },
      relations: ["ticket"],
    });
    if (!expense) { res.status(404).json({ message: "Không tìm thấy khoản chi" }); return; }

    const { approved } = req.body; // boolean

    if (approved) {
      expense.status = ExpenseStatus.APPROVED;
    } else {
      expense.status = ExpenseStatus.REJECTED;
      // Set parent ticket to NEEDS_EXPLANATION
      await ticketRepo().update(expense.ticket_id, {
        status: TicketStatus.NEEDS_EXPLANATION,
      });
    }

    await expenseRepo().save(expense);
    res.json(expense);
  } catch (error) {
    console.error("Approve expense error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

export default router;
