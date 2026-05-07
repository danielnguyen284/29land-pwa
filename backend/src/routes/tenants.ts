import { Router, Response } from "express";
import { AppDataSource } from "../data-source";
import { Tenant } from "../entities/Tenant";
import { Contract, ContractStatus } from "../entities/Contract";
import { Room, RoomStatus } from "../entities/Room";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";
import { UserRole } from "../entities/User";
import { Building } from "../entities/Building";
import { BuildingManager } from "../entities/BuildingManager";
import { uploadToImgBB } from "../services/imgbb";

const router = Router();
const tenantRepo = () => AppDataSource.getRepository(Tenant);
const contractRepo = () => AppDataSource.getRepository(Contract);
const roomRepo = () => AppDataSource.getRepository(Room);
const buildingRepo = () => AppDataSource.getRepository(Building);
const managerRepo = () => AppDataSource.getRepository(BuildingManager);

router.use(authenticate);

// ─── Tenants ───

// GET /api/rooms/:roomId/tenants
router.get("/:roomId/tenants", async (req: AuthRequest, res: Response) => {
  try {
    const tenants = await tenantRepo().find({
      where: { room_id: req.params.roomId as string },
      order: { is_representative: "DESC", name: "ASC" },
    });
    res.json(tenants);
  } catch (error) {
    console.error("List tenants error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/rooms/:roomId/tenants
router.post("/:roomId/tenants", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const room_id = req.params.roomId as string;
    const { name, cccd, phone, is_representative } = req.body;
    if (!name) { res.status(400).json({ message: "Tên là bắt buộc" }); return; }

    // If marking as representative, unset any existing one
    if (is_representative) {
      await tenantRepo().update({ room_id, is_representative: true }, { is_representative: false });
    }

    // Find if there is an active contract in this room to automatically link the tenant
    const activeContract = await contractRepo().findOne({
      where: { room_id, status: ContractStatus.ACTIVE },
      order: { created_at: "DESC" }
    });

    const tenant = tenantRepo().create({
      room_id,
      contract_id: activeContract ? activeContract.id : undefined,
      name,
      cccd: cccd || undefined,
      phone: phone || undefined,
      is_representative: is_representative || false,
      status: "ACTIVE",
    });

    const saved = await tenantRepo().save(tenant);
    res.status(201).json(saved);
  } catch (error) {
    console.error("Create tenant error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/rooms/:roomId/tenants/:tenantId
router.patch("/:roomId/tenants/:tenantId", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const tenant = await tenantRepo().findOneBy({ id: req.params.tenantId as string });
    if (!tenant) { res.status(404).json({ message: "Không tìm thấy khách thuê" }); return; }

    const { name, cccd, phone, is_representative, status } = req.body;
    if (name !== undefined) tenant.name = name;
    if (cccd !== undefined) tenant.cccd = cccd;
    if (phone !== undefined) tenant.phone = phone;
    if (status !== undefined) tenant.status = status;

    if (is_representative === true) {
      await tenantRepo().update({ room_id: tenant.room_id, is_representative: true }, { is_representative: false });
      tenant.is_representative = true;
    } else if (is_representative === false) {
      tenant.is_representative = false;
    }

    await tenantRepo().save(tenant);
    res.json(tenant);
  } catch (error) {
    console.error("Update tenant error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// ─── Contracts ───

// GET /api/rooms/:roomId/contracts
router.get("/:roomId/contracts", async (req: AuthRequest, res: Response) => {
  try {
    const contracts = await contractRepo().find({
      where: { room_id: req.params.roomId as string },
      relations: ["representative_tenant"],
      order: { created_at: "DESC" },
    });
    res.json(contracts);
  } catch (error) {
    console.error("List contracts error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/rooms/:roomId/contracts
router.post("/:roomId/contracts", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const room_id = req.params.roomId as string;
    const { representative_tenant_id, start_date, end_date, rent_amount, deposit_amount, document_photos, tenant_ids } = req.body;

    if (!representative_tenant_id || !start_date || !end_date) {
      res.status(400).json({ message: "representative_tenant_id, start_date, end_date là bắt buộc" });
      return;
    }

    // Check for existing active/new contracts for this room
    const existingContract = await contractRepo().findOne({
      where: [
        { room_id, status: ContractStatus.ACTIVE },
        { room_id, status: ContractStatus.NEW }
      ]
    });

    if (existingContract) {
      res.status(400).json({ message: "Phòng này hiện đang có hợp đồng hoạt động. Vui lòng thanh lý hoặc hủy hợp đồng cũ trước khi tạo hợp đồng mới." });
      return;
    }

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const startDateObj = new Date(start_date);
    startDateObj.setHours(0, 0, 0, 0);

    const isFutureContract = startDateObj > todayDate;
    const initialContractStatus = isFutureContract ? ContractStatus.NEW : ContractStatus.ACTIVE;

    const contract = contractRepo().create({
      room_id,
      representative_tenant_id,
      start_date,
      end_date,
      rent_amount: rent_amount || 0,
      deposit_amount: deposit_amount || 0,
      status: initialContractStatus,
      document_photos: document_photos || [],
    });

    const saved = await contractRepo().save(contract);

    // Link provided tenant_ids and the representative tenant to this contract
    const idsToAssign = Array.isArray(tenant_ids) ? [...tenant_ids] : [];
    if (!idsToAssign.includes(representative_tenant_id)) {
      idsToAssign.push(representative_tenant_id);
    }
    if (idsToAssign.length > 0) {
      await AppDataSource.createQueryBuilder()
        .update(Tenant)
        .set({ 
          contract_id: saved.id,
          room_id: room_id,
          status: "ACTIVE"
        })
        .where("id IN (:...ids)", { ids: idsToAssign })
        .execute();
    }

    // Update room status
    const newRoomStatus = isFutureContract ? RoomStatus.DEPOSITED : RoomStatus.OCCUPIED;
    await roomRepo().update(room_id, { status: newRoomStatus });

    res.status(201).json(saved);
  } catch (error) {
    console.error("Create contract error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/rooms/:roomId/contracts/:contractId
router.patch("/:roomId/contracts/:contractId", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const contract = await contractRepo().findOneBy({ id: req.params.contractId as string });
    if (!contract) { res.status(404).json({ message: "Không tìm thấy hợp đồng" }); return; }

    const { status, end_date, rent_amount, deposit_amount, document_photos, tenant_ids } = req.body;
    if (status !== undefined) contract.status = status;
    if (end_date !== undefined) contract.end_date = end_date;
    if (rent_amount !== undefined) contract.rent_amount = rent_amount;
    if (deposit_amount !== undefined) contract.deposit_amount = deposit_amount;
    if (document_photos !== undefined) contract.document_photos = document_photos;

    await contractRepo().save(contract);

    // Update tenants if tenant_ids provided
    if (tenant_ids !== undefined && Array.isArray(tenant_ids)) {
      const newIds = [...tenant_ids];
      if (!newIds.includes(contract.representative_tenant_id)) {
        newIds.push(contract.representative_tenant_id);
      }

      // 1. Mark tenants who were in this contract but not in the new list as INACTIVE
      await AppDataSource.createQueryBuilder()
        .update(Tenant)
        .set({ status: "INACTIVE", contract_id: null as any })
        .where("contract_id = :contractId", { contractId: contract.id })
        .andWhere("id NOT IN (:...newIds)", { newIds })
        .execute();

      // 2. Mark new tenants as ACTIVE and link to this contract/room
      await AppDataSource.createQueryBuilder()
        .update(Tenant)
        .set({ 
          status: "ACTIVE", 
          contract_id: contract.id,
          room_id: contract.room_id
        })
        .where("id IN (:...newIds)", { newIds })
        .execute();
    }

    // If terminated, set room to EMPTY
    if (status === ContractStatus.TERMINATED || status === ContractStatus.EXPIRED) {
      await roomRepo().update(contract.room_id, { status: RoomStatus.EMPTY });
    }

    res.json(contract);
  } catch (error) {
    console.error("Update contract error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/rooms/:roomId/contracts/:contractId/terminate
router.post("/:roomId/contracts/:contractId/terminate", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const contract = await contractRepo().findOneBy({ id: req.params.contractId as string });
    if (!contract) { res.status(404).json({ message: "Không tìm thấy hợp đồng" }); return; }

    // Deposit settlement: (Deposit) - (LastMonthRent) - (DamageFees) = Refund
    const { last_month_rent, damage_fees, notes, actual_end_date } = req.body;
    const refund = contract.deposit_amount - (last_month_rent || 0) - (damage_fees || 0);

    contract.status = ContractStatus.TERMINATED;
    contract.refunded_deposit = refund;
    contract.actual_end_date = actual_end_date || new Date().toISOString().split("T")[0];
    if (notes) contract.notes = notes;
    await contractRepo().save(contract);

    // Set room to EMPTY
    await roomRepo().update(contract.room_id, { status: RoomStatus.EMPTY });

    // Deactivate ONLY tenants in this specific contract
    await tenantRepo().update({ contract_id: contract.id }, { status: "INACTIVE" });

    res.json({
      message: "Đã thanh lý hợp đồng",
      deposit: Number(contract.deposit_amount),
      last_month_rent: last_month_rent || 0,
      damage_fees: damage_fees || 0,
      refund_amount: refund,
      notes,
    });
  } catch (error) {
    console.error("Terminate contract error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/rooms/:roomId/contracts/:contractId/cancel
router.post("/:roomId/contracts/:contractId/cancel", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const contract = await contractRepo().findOneBy({ id: req.params.contractId as string });
    if (!contract) { res.status(404).json({ message: "Không tìm thấy hợp đồng" }); return; }

    const { notes } = req.body;

    contract.status = ContractStatus.CANCELLED;
    if (notes) contract.notes = notes;
    await contractRepo().save(contract);

    // Set room to EMPTY
    await roomRepo().update(contract.room_id, { status: RoomStatus.EMPTY });

    // Deactivate ONLY tenants in this specific contract
    await tenantRepo().update({ contract_id: contract.id }, { status: "INACTIVE" });

    res.json({ message: "Đã hủy hợp đồng" });
  } catch (error) {
    console.error("Cancel contract error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/rooms/:roomId/contracts/:contractId/reactivate
router.post("/:roomId/contracts/:contractId/reactivate", requireRole(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  try {
    const contract = await contractRepo().findOneBy({ id: req.params.contractId as string });
    if (!contract) { res.status(404).json({ message: "Không tìm thấy hợp đồng" }); return; }

    if (contract.status !== ContractStatus.CANCELLED) {
      res.status(400).json({ message: "Chỉ được phép kích hoạt lại hợp đồng bị Hủy giữa chừng (CANCELLED)." });
      return;
    }

    const room = await roomRepo().findOneBy({ id: contract.room_id });
    if (room && room.status === RoomStatus.OCCUPIED) {
      res.status(400).json({ message: "Phòng đang thuê (hợp đồng khác đang hiệu lực). Không thể kích hoạt." });
      return;
    }

    const today = new Date();
    const endDate = new Date(contract.end_date);
    
    // Reset time components for accurate comparison
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (endDate < today) {
      res.status(400).json({ message: "Hợp đồng này đã hết hạn. Vui lòng tạo hợp đồng mới." });
      return;
    }

    contract.status = ContractStatus.ACTIVE;
    await contractRepo().save(contract);

    // Set room to OCCUPIED
    await roomRepo().update(contract.room_id, { status: RoomStatus.OCCUPIED });

    // Reactivate ONLY tenants in this specific contract
    await tenantRepo().update({ contract_id: contract.id }, { status: "ACTIVE" });

    res.json({ message: "Đã kích hoạt lại hợp đồng", status: contract.status });
  } catch (error) {
    console.error("Reactivate contract error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// GET /api/contracts/expiring — contracts expiring within 30 days
router.get("/contracts/expiring", async (_req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const contracts = await contractRepo()
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.representative_tenant", "t")
      .leftJoinAndSelect("c.room", "r")
      .where("c.status = :status", { status: ContractStatus.ACTIVE })
      .andWhere("c.end_date <= :limit", { limit: thirtyDays.toISOString().split("T")[0] })
      .andWhere("c.end_date >= :today", { today: today.toISOString().split("T")[0] })
      .orderBy("c.end_date", "ASC")
      .getMany();

    res.json(contracts);
  } catch (error) {
    console.error("Expiring contracts error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/upload — upload image to ImgBB
router.post("/upload", async (req: AuthRequest, res: Response) => {
  try {
    const { image } = req.body;
    if (!image) { res.status(400).json({ message: "image (base64) là bắt buộc" }); return; }
    const url = await uploadToImgBB(image);
    res.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Lỗi upload ảnh" });
  }
});

export default router;

export const globalTenantRouter = Router();
globalTenantRouter.use(authenticate);

globalTenantRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { role, id } = req.user!;
    const { building_id, room_id, status, search } = req.query;

    let allowedBuildingIds: string[] = [];

    // RBAC: Determine allowed buildings
    if (role === UserRole.ADMIN) {
      if (building_id) allowedBuildingIds = [building_id as string];
    } else if (role === UserRole.OWNER) {
      const buildings = await buildingRepo().find({ where: { owner_id: id } });
      allowedBuildingIds = buildings.map(b => b.id);
      if (building_id && allowedBuildingIds.includes(building_id as string)) {
        allowedBuildingIds = [building_id as string];
      } else if (building_id) {
        return res.json([]);
      }
    } else if (role === UserRole.MANAGER) {
      const assignments = await managerRepo().find({ where: { manager_id: id } });
      allowedBuildingIds = assignments.map(a => a.building_id);
      if (building_id && allowedBuildingIds.includes(building_id as string)) {
        allowedBuildingIds = [building_id as string];
      } else if (building_id) {
        return res.json([]);
      }
    }

    if (role !== UserRole.ADMIN && allowedBuildingIds.length === 0) {
      return res.json([]);
    }

    const qb = tenantRepo().createQueryBuilder("t")
      .leftJoinAndSelect("t.room", "r")
      .leftJoinAndSelect("r.floor", "f")
      .leftJoinAndSelect("f.building", "b");

    if (role !== UserRole.ADMIN || allowedBuildingIds.length > 0) {
      qb.andWhere("f.building_id IN (:...allowedBuildingIds)", { allowedBuildingIds });
    }

    if (room_id) {
      qb.andWhere("t.room_id = :room_id", { room_id });
    }

    if (status) {
      qb.andWhere("t.status = :status", { status });
    }

    if (search) {
      qb.andWhere("(LOWER(t.name) LIKE LOWER(:search) OR t.phone LIKE :search OR t.cccd LIKE :search)", { search: `%${search}%` });
    }

    qb.orderBy("t.created_at", "DESC");

    const tenants = await qb.getMany();
    
    res.json(tenants);
  } catch (error) {
    console.error("List global tenants error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});
