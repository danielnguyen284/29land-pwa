import { Router, Response } from "express";
import { AppDataSource } from "../data-source";
import { Room, RoomStatus } from "../entities/Room";
import { Invoice } from "../entities/Invoice";
import { TicketExpense, ExpenseStatus } from "../entities/TicketExpense";
import { Ticket } from "../entities/Ticket";
import { Tenant } from "../entities/Tenant";
import { Contract, ContractStatus } from "../entities/Contract";
import { BuildingManager } from "../entities/BuildingManager";
import { Building } from "../entities/Building";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";
import { UserRole } from "../entities/User";
import { In } from "typeorm";

const router = Router();
const roomRepo = () => AppDataSource.getRepository(Room);
const invoiceRepo = () => AppDataSource.getRepository(Invoice);
const expenseRepo = () => AppDataSource.getRepository(TicketExpense);
const ticketRepo = () => AppDataSource.getRepository(Ticket);
const tenantRepo = () => AppDataSource.getRepository(Tenant);
const contractRepo = () => AppDataSource.getRepository(Contract);
const managerRepo = () => AppDataSource.getRepository(BuildingManager);
const buildingRepo = () => AppDataSource.getRepository(Building);

router.use(authenticate);

// Helper to get accessible building IDs based on role
async function getAccessibleBuildingIds(user: NonNullable<AuthRequest["user"]>, queryBuildingId?: string): Promise<string[]> {
  let accessibleIds: string[] = [];

  if (user.role === UserRole.ADMIN) {
    const buildings = await buildingRepo().find({ select: ["id"] });
    accessibleIds = buildings.map((b) => b.id);
  } else if (user.role === UserRole.OWNER) {
    const buildings = await buildingRepo().find({ where: { owner_id: user.id }, select: ["id"] });
    accessibleIds = buildings.map((b) => b.id);
  } else if (user.role === UserRole.MANAGER) {
    const assignments = await managerRepo().find({ where: { manager_id: user.id } });
    accessibleIds = assignments.map((a) => a.building_id);
  }

  // Filter by requested building ID if provided and accessible
  if (queryBuildingId) {
    if (accessibleIds.includes(queryBuildingId)) {
      return [queryBuildingId];
    } else {
      return []; // Requested building not accessible
    }
  }

  return accessibleIds;
}

// GET /api/reports/dashboard
router.get("/dashboard", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const { building_id, period } = req.query;
    const targetPeriod = (period as string) || new Date().toISOString().substring(0, 7); // Default to current YYYY-MM
    
    const buildingIds = await getAccessibleBuildingIds(req.user!, building_id as string);
    if (buildingIds.length === 0) {
      res.json({
        period: targetPeriod,
        occupancy: { total: 0, occupied: 0, rate: 0 },
        revenue: { expected: 0, collected: 0, outstanding: 0 },
        expenses: { total: 0 },
        tickets: { total: 0, pending: 0, in_progress: 0, completed: 0 },
        tenants: { total: 0 },
        contracts: { total: 0, expiring: 0 }
      });
      return;
    }

    // 1. Occupancy
    const rooms = await roomRepo()
      .createQueryBuilder("r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .getMany();

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r) => r.status === RoomStatus.OCCUPIED).length;
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // 2. Revenue & Debt
    const invoices = await invoiceRepo()
      .createQueryBuilder("inv")
      .innerJoin("inv.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .andWhere("inv.billing_period = :period", { period: targetPeriod })
      .getMany();

    let expectedRevenue = 0;
    let collectedRevenue = 0;
    
    for (const inv of invoices) {
      expectedRevenue += Number(inv.total_amount);
      collectedRevenue += Number(inv.paid_amount);
    }

    // Add deposits from new contracts in this period to revenue
    const newContractsInPeriod = await contractRepo()
      .createQueryBuilder("c")
      .innerJoin("c.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .andWhere("CAST(c.start_date AS TEXT) LIKE :period", { period: `${targetPeriod}%` })
      .getMany();

    for (const c of newContractsInPeriod) {
      expectedRevenue += Number(c.deposit_amount);
      collectedRevenue += Number(c.deposit_amount);
    }

    const outstandingDebt = expectedRevenue - collectedRevenue;

    // 3. Expenses (Approved ticket expenses in the given month)
    // To filter by month, we check the created_at of the expense
    const startDate = new Date(`${targetPeriod}-01T00:00:00.000Z`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);

    const expenses = await expenseRepo()
      .createQueryBuilder("e")
      .innerJoin("e.ticket", "t")
      .innerJoin("t.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .andWhere("e.status = :status", { status: ExpenseStatus.APPROVED })
      .andWhere("e.created_at >= :startDate AND e.created_at < :endDate", { startDate, endDate })
      .getMany();

    let totalExpenses = 0;
    for (const exp of expenses) {
      totalExpenses += Number(exp.amount);
    }

    // Add refunded deposits from terminated contracts in this period to expenses
    const terminatedContractsInPeriod = await contractRepo()
      .createQueryBuilder("c")
      .innerJoin("c.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .andWhere("c.status = :status", { status: ContractStatus.TERMINATED })
      .andWhere("CAST(c.actual_end_date AS TEXT) LIKE :period", { period: `${targetPeriod}%` })
      .getMany();

    for (const c of terminatedContractsInPeriod) {
      if (c.refunded_deposit !== null) {
        totalExpenses += Number(c.refunded_deposit);
      }
    }

    // 4. Maintenance Tickets (Created in the period)
    const tickets = await ticketRepo()
      .createQueryBuilder("t")
      .innerJoin("t.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .andWhere("t.created_at >= :startDate AND t.created_at < :endDate", { startDate, endDate })
      .getMany();

    const ticketsSummary = {
      total: tickets.length,
      pending: tickets.filter(t => t.status === "PENDING").length,
      in_progress: tickets.filter(t => t.status === "IN_PROGRESS").length,
      completed: tickets.filter(t => t.status === "COMPLETED").length,
    };

    // 5. Tenants
    const tenants = await tenantRepo()
      .createQueryBuilder("t")
      .innerJoin("t.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .andWhere("t.status = :status", { status: "ACTIVE" })
      .getCount();

    // 6. Contracts
    const contracts = await contractRepo()
      .createQueryBuilder("c")
      .innerJoin("c.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .andWhere("c.status IN (:...statuses)", { statuses: [ContractStatus.ACTIVE, ContractStatus.NEW] })
      .getMany();

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    let expiringContractsCount = 0;
    for (const c of contracts) {
      if (new Date(c.end_date) <= thirtyDaysFromNow) {
        expiringContractsCount++;
      }
    }

    res.json({
      period: targetPeriod,
      occupancy: {
        total: totalRooms,
        occupied: occupiedRooms,
        rate: Math.round(occupancyRate * 100) / 100, // Round to 2 decimals
      },
      revenue: {
        expected: expectedRevenue,
        collected: collectedRevenue,
        outstanding: outstandingDebt,
      },
      expenses: {
        total: totalExpenses,
      },
      tickets: ticketsSummary,
      tenants: {
        total: tenants,
      },
      contracts: {
        total: contracts.length,
        expiring: expiringContractsCount,
      }
    });
  } catch (error) {
    console.error("Dashboard report error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// GET /api/reports/revenue-stats
router.get("/revenue-stats", requireRole(UserRole.ADMIN, UserRole.OWNER), async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, building_ids } = req.query;
    
    // Parse dates or set defaults
    let end = new Date();
    if (endDate) {
      end = new Date(endDate as string);
    }
    
    let start = new Date();
    start.setMonth(start.getMonth() - 5); // 6 months inclusive (current + 5 previous)
    start.setDate(1); // Start of that month
    if (startDate) {
      start = new Date(startDate as string);
    }

    const queryBuildingIds = building_ids ? (building_ids as string).split(",") : undefined;
    const buildingIds = await getAccessibleBuildingIds(req.user!, undefined); // Get all accessible first
    
    // Filter by requested
    const targetBuildingIds = queryBuildingIds ? buildingIds.filter(id => queryBuildingIds.includes(id)) : buildingIds;

    if (targetBuildingIds.length === 0) {
      res.json({ 
        aggregate: { totalRevenue: 0, totalExpense: 0, netProfit: 0, occupancyRate: 0, totalTenants: 0 }, 
        breakdown: { invoicesRevenue: 0, depositsRevenue: 0, refundExpenses: 0, maintenanceExpenses: 0 },
        chartData: [] 
      });
      return;
    }

    let invoicesRevenue = 0;
    let depositsRevenue = 0;
    let refundExpenses = 0;
    let maintenanceExpenses = 0;

    // Generate month buckets between start and end
    const chartDataMap = new Map<string, { period: string; revenue: number; expense: number; profit: number }>();
    
    const curr = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    
    while (curr <= endMonth) {
      const monthStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
      chartDataMap.set(monthStr, { period: monthStr, revenue: 0, expense: 0, profit: 0 });
      curr.setMonth(curr.getMonth() + 1);
    }

    const startDateStr = start.toISOString().split('T')[0];
    // For end date, we should include the whole end day. Let's just use the end date + 1 day or similar, but since we are doing <= for date strings it should be fine if end date string is set properly.
    const endDateObj = new Date(end);
    endDateObj.setHours(23, 59, 59, 999);
    const endDateStr = endDateObj.toISOString().split('T')[0];

    // 1. Invoices
    const invoices = await invoiceRepo()
      .createQueryBuilder("inv")
      .innerJoin("inv.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds: targetBuildingIds })
      .andWhere("inv.issue_date >= :start AND inv.issue_date <= :end", { start: startDateStr, end: endDateStr })
      .getMany();

    invoices.forEach(inv => {
      const monthStr = inv.issue_date.substring(0, 7); // YYYY-MM
      const bucket = chartDataMap.get(monthStr);
      if (bucket) {
        bucket.revenue += Number(inv.paid_amount);
        invoicesRevenue += Number(inv.paid_amount);
      }
    });

    // 2. Contracts (Deposits in)
    const newContracts = await contractRepo()
      .createQueryBuilder("c")
      .innerJoin("c.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds: targetBuildingIds })
      .andWhere("c.start_date >= :start AND c.start_date <= :end", { start: startDateStr, end: endDateStr })
      .getMany();

    newContracts.forEach(c => {
      const monthStr = c.start_date.substring(0, 7);
      const bucket = chartDataMap.get(monthStr);
      if (bucket) {
        bucket.revenue += Number(c.deposit_amount);
        depositsRevenue += Number(c.deposit_amount);
      }
    });

    // 3. Contracts (Refunds out)
    const terminatedContracts = await contractRepo()
      .createQueryBuilder("c")
      .innerJoin("c.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds: targetBuildingIds })
      .andWhere("c.status = :status", { status: ContractStatus.TERMINATED })
      .andWhere("c.actual_end_date >= :start AND c.actual_end_date <= :end", { start: startDateStr, end: endDateStr })
      .getMany();

    terminatedContracts.forEach(c => {
      if (c.refunded_deposit) {
        const monthStr = c.actual_end_date!.substring(0, 7);
        const bucket = chartDataMap.get(monthStr);
        if (bucket) {
          bucket.expense += Number(c.refunded_deposit);
          refundExpenses += Number(c.refunded_deposit);
        }
      }
    });

    // 4. Ticket Expenses
    const expenses = await expenseRepo()
      .createQueryBuilder("e")
      .innerJoin("e.ticket", "t")
      .innerJoin("t.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds: targetBuildingIds })
      .andWhere("e.status = :status", { status: ExpenseStatus.APPROVED })
      .andWhere("e.created_at >= :start AND e.created_at <= :end", { start, end: endDateObj })
      .getMany();

    expenses.forEach(e => {
      const monthStr = e.created_at.toISOString().substring(0, 7);
      const bucket = chartDataMap.get(monthStr);
      if (bucket) {
        bucket.expense += Number(e.amount);
        maintenanceExpenses += Number(e.amount);
      }
    });

    // Calculate totals and profits
    let totalRevenue = 0;
    let totalExpense = 0;
    
    const chartData = Array.from(chartDataMap.values()).map(bucket => {
      bucket.profit = bucket.revenue - bucket.expense;
      totalRevenue += bucket.revenue;
      totalExpense += bucket.expense;
      return bucket;
    }).sort((a, b) => a.period.localeCompare(b.period));

    // Occupancy & Tenants snapshot
    const rooms = await roomRepo()
      .createQueryBuilder("r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds: targetBuildingIds })
      .getMany();

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r) => r.status === RoomStatus.OCCUPIED).length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 10000) / 100 : 0; // percentage

    const tenants = await tenantRepo()
      .createQueryBuilder("t")
      .innerJoin("t.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds: targetBuildingIds })
      .andWhere("t.status = :status", { status: "ACTIVE" })
      .getCount();

    res.json({
      aggregate: {
        totalRevenue,
        totalExpense,
        netProfit: totalRevenue - totalExpense,
        occupancyRate,
        totalTenants: tenants
      },
      breakdown: {
        invoicesRevenue,
        depositsRevenue,
        refundExpenses,
        maintenanceExpenses
      },
      chartData
    });
  } catch (error) {
    console.error("Revenue stats error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

export default router;
