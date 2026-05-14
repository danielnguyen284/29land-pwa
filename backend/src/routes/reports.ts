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
import { Transaction } from "../entities/Transaction";
import { TransactionType } from "../entities/TransactionCategory";

const router = Router();
const roomRepo = () => AppDataSource.getRepository(Room);
const invoiceRepo = () => AppDataSource.getRepository(Invoice);
const expenseRepo = () => AppDataSource.getRepository(TicketExpense);
const ticketRepo = () => AppDataSource.getRepository(Ticket);
const tenantRepo = () => AppDataSource.getRepository(Tenant);
const contractRepo = () => AppDataSource.getRepository(Contract);
const managerRepo = () => AppDataSource.getRepository(BuildingManager);
const buildingRepo = () => AppDataSource.getRepository(Building);
const transactionRepo = () => AppDataSource.getRepository(Transaction);

router.use(authenticate);

// Helper to get accessible building IDs based on role
async function getAccessibleBuildingIds(user: NonNullable<AuthRequest["user"]>, queryBuildingId?: string): Promise<string[]> {
  let accessibleIds: string[] = [];

  if (user.role === UserRole.ADMIN) {
    const buildings = await buildingRepo().find({ select: ["id"] });
    accessibleIds = buildings.map((b) => b.id);
  } else if (user.role === UserRole.OWNER) {
    const ownerRepo = AppDataSource.getRepository("BuildingOwner");
    const ownerships = await ownerRepo.find({ where: { owner_id: user.id } });
    const ids = ownerships.map((o: any) => o.building_id);
    
    let buildings;
    if (ids.length > 0) {
      buildings = await buildingRepo().find({ 
        where: [ { id: In(ids) }, { owner_id: user.id } ], 
        select: ["id"] 
      });
    } else {
      buildings = await buildingRepo().find({ 
        where: { owner_id: user.id }, 
        select: ["id"] 
      });
    }
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
        tickets: { total: 0, pending: 0, completed: 0 },
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

    // 2. Revenue (All time)
    const invoiceSum = await invoiceRepo()
      .createQueryBuilder("inv")
      .innerJoin("inv.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .select("SUM(inv.total_amount)", "expected")
      .addSelect("SUM(inv.paid_amount)", "collected")
      .getRawOne();

    let expectedRevenue = Number(invoiceSum?.expected || 0);
    let collectedRevenue = Number(invoiceSum?.collected || 0);

    // Add deposits from all contracts to revenue
    const contractSum = await contractRepo()
      .createQueryBuilder("c")
      .innerJoin("c.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .select("SUM(c.deposit_amount)", "deposit")
      .getRawOne();

    expectedRevenue += Number(contractSum?.deposit || 0);
    collectedRevenue += Number(contractSum?.deposit || 0);

    // 3. Expenses (All time)
    const expenseSum = await expenseRepo()
      .createQueryBuilder("e")
      .innerJoin("e.ticket", "t")
      .innerJoin("t.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .andWhere("e.status = :status", { status: ExpenseStatus.APPROVED })
      .select("SUM(e.amount)", "total")
      .getRawOne();

    let totalExpenses = Number(expenseSum?.total || 0);

    // Add refunded deposits from all terminated contracts to expenses
    const refundedDepositSum = await contractRepo()
      .createQueryBuilder("c")
      .innerJoin("c.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .andWhere("c.status = :status", { status: ContractStatus.TERMINATED })
      .select("SUM(c.refunded_deposit)", "refunded")
      .getRawOne();

    totalExpenses += Number(refundedDepositSum?.refunded || 0);

    // 4. Other Transactions (Income/Expense) (All time)
    const transactionSums = await transactionRepo()
      .createQueryBuilder("tr")
      .where("tr.building_id IN (:...buildingIds)", { buildingIds })
      .select("tr.type", "type")
      .addSelect("SUM(tr.amount)", "amount")
      .groupBy("tr.type")
      .getRawMany();

    for (const tr of transactionSums) {
      if (tr.type === TransactionType.EXPENSE) {
        totalExpenses += Number(tr.amount || 0);
      } else if (tr.type === TransactionType.INCOME) {
        expectedRevenue += Number(tr.amount || 0);
        collectedRevenue += Number(tr.amount || 0);
      }
    }

    const outstandingDebt = expectedRevenue - collectedRevenue;

    // 5. Maintenance Tickets (Created in the period)
    const startDate = new Date(`${targetPeriod}-01T00:00:00.000Z`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);

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
      completed: tickets.filter(t => t.status === "COMPLETED").length,
    };

    // 6. Tenants
    const tenants = await tenantRepo()
      .createQueryBuilder("t")
      .innerJoin("t.room", "r")
      .innerJoin("r.floor", "f")
      .where("f.building_id IN (:...buildingIds)", { buildingIds })
      .andWhere("t.status = :status", { status: "ACTIVE" })
      .getCount();

    // 7. Contracts
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
    let otherIncome = 0;
    let otherExpense = 0;

    const invoiceItemsMap = new Map<string, number>();
    const transactionCategoriesMap = new Map<string, { type: "INCOME" | "EXPENSE", amount: number }>();

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
      .leftJoinAndSelect("inv.items", "item")
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
      
      if (queryBuildingIds && queryBuildingIds.length === 1) {
        const totalAmt = Number(inv.total_amount);
        const paidAmt = Number(inv.paid_amount);
        const ratio = totalAmt > 0 ? paidAmt / totalAmt : 0;
        
        if (inv.items && inv.items.length > 0) {
          inv.items.forEach(item => {
            let name = item.description || "Tiền phòng";
            // Clean description to group by service type (e.g., "Nước: 1 -> 3 = 2 x 25,000" becomes "Nước")
            if (name.includes(":") && (name.includes("→") || name.includes("->") || name.includes("="))) {
              name = name.split(":")[0].trim();
            }
            const itemPaid = Number(item.amount) * ratio;
            invoiceItemsMap.set(name, (invoiceItemsMap.get(name) || 0) + itemPaid);
          });
        }
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

    // 5. Other Transactions (Thu chi)
    const transactionStartPeriod = start.toISOString().substring(0, 7);
    const transactionEndPeriod = endDateObj.toISOString().substring(0, 7);
    
    const transactions = await transactionRepo()
      .createQueryBuilder("tr")
      .leftJoinAndSelect("tr.category", "cat")
      .where("tr.building_id IN (:...buildingIds)", { buildingIds: targetBuildingIds })
      .andWhere("tr.accounting_period >= :startPeriod AND tr.accounting_period <= :endPeriod", { 
        startPeriod: transactionStartPeriod, 
        endPeriod: transactionEndPeriod 
      })
      .getMany();

    transactions.forEach(tr => {
      const bucket = chartDataMap.get(tr.accounting_period);
      if (bucket) {
        if (tr.type === TransactionType.INCOME) {
          bucket.revenue += Number(tr.amount);
          otherIncome += Number(tr.amount);
        } else {
          bucket.expense += Number(tr.amount);
          otherExpense += Number(tr.amount);
        }
      }

      if (queryBuildingIds && queryBuildingIds.length === 1) {
        const catName = tr.category?.name || (tr.type === TransactionType.INCOME ? "Thu khác" : "Chi khác");
        const existing = transactionCategoriesMap.get(catName) || { type: tr.type as "INCOME" | "EXPENSE", amount: 0 };
        existing.amount += Number(tr.amount);
        transactionCategoriesMap.set(catName, existing);
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

    const detailedBreakdown: Array<{name: string, type: string, amount: number}> = [];

    if (queryBuildingIds && queryBuildingIds.length === 1) {
       for (const [name, amount] of invoiceItemsMap.entries()) {
          detailedBreakdown.push({ name, type: "INCOME", amount });
       }
       if (depositsRevenue > 0) {
          detailedBreakdown.push({ name: "Thu cọc", type: "INCOME", amount: depositsRevenue });
       }
       if (refundExpenses > 0) {
          detailedBreakdown.push({ name: "Hoàn cọc", type: "EXPENSE", amount: refundExpenses });
       }
       if (maintenanceExpenses > 0) {
          detailedBreakdown.push({ name: "Chi phí bảo trì", type: "EXPENSE", amount: maintenanceExpenses });
       }
       for (const [name, data] of transactionCategoriesMap.entries()) {
          detailedBreakdown.push({ name, type: data.type, amount: data.amount });
       }
    }

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
        maintenanceExpenses,
        otherIncome,
        otherExpense
      },
      detailedBreakdown,
      chartData
    });
  } catch (error) {
    console.error("Revenue stats error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

export default router;
