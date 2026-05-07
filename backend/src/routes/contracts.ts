import { Router, Response } from "express";
import { AppDataSource } from "../data-source";
import { Contract } from "../entities/Contract";
import { Building } from "../entities/Building";
import { BuildingManager } from "../entities/BuildingManager";
import { UserRole } from "../entities/User";
import { authenticate, AuthRequest } from "../middlewares/auth";

const router = Router();
const contractRepo = () => AppDataSource.getRepository(Contract);
const buildingRepo = () => AppDataSource.getRepository(Building);
const managerRepo = () => AppDataSource.getRepository(BuildingManager);

router.use(authenticate);

// GET /api/contracts — List all contracts based on role and optional filters
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { role, id } = req.user!;
    const { building_id, room_id, status } = req.query;

    let allowedBuildingIds: string[] = [];

    // RBAC: Determine allowed buildings
    if (role === UserRole.ADMIN) {
      // Admin sees all, no restriction on buildingIds unless specified in query
      if (building_id) {
        allowedBuildingIds = [building_id as string];
      }
    } else if (role === UserRole.OWNER) {
      const buildings = await buildingRepo().find({ where: { owner_id: id } });
      allowedBuildingIds = buildings.map(b => b.id);
      if (building_id && allowedBuildingIds.includes(building_id as string)) {
        allowedBuildingIds = [building_id as string];
      } else if (building_id) {
        // Requested a building they don't own
        return res.json([]);
      }
    } else if (role === UserRole.MANAGER) {
      const assignments = await managerRepo().find({ where: { manager_id: id } });
      allowedBuildingIds = assignments.map(a => a.building_id);
      if (building_id && allowedBuildingIds.includes(building_id as string)) {
        allowedBuildingIds = [building_id as string];
      } else if (building_id) {
        // Requested a building they don't manage
        return res.json([]);
      }
    }

    // If not admin and no allowed buildings, return empty
    if (role !== UserRole.ADMIN && allowedBuildingIds.length === 0) {
      return res.json([]);
    }

    // Build query
    const qb = contractRepo().createQueryBuilder("c")
      .leftJoinAndSelect("c.room", "r")
      .leftJoinAndSelect("c.representative_tenant", "t")
      .leftJoinAndSelect("c.tenants", "tenants")
      .leftJoinAndSelect("r.floor", "f")
      .leftJoinAndSelect("f.building", "b");

    if (role !== UserRole.ADMIN || allowedBuildingIds.length > 0) {
      qb.andWhere("f.building_id IN (:...allowedBuildingIds)", { allowedBuildingIds });
    }

    if (room_id) {
      qb.andWhere("c.room_id = :room_id", { room_id });
    }

    if (status) {
      qb.andWhere("c.status = :status", { status });
    }

    qb.orderBy("c.created_at", "DESC");

    const contracts = await qb.getMany();
    
    // Also include floor information in room manually if needed, 
    // but the query builder selected r and t. 
    // If we need floor or building info we could add leftJoinAndSelect.
    
    res.json(contracts);
  } catch (error) {
    console.error("List contracts error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// GET /api/contracts/:id — Get a single contract with relations
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const contract = await contractRepo().findOne({
      where: { id: req.params.id as string },
      relations: ["room", "representative_tenant", "tenants", "room.floor", "room.floor.building"]
    });

    if (!contract) {
      return res.status(404).json({ message: "Không tìm thấy hợp đồng" });
    }

    // RBAC: Check if user has access to this building
    const { role, id } = req.user!;
    const buildingId = contract.room.floor.building_id;

    if (role === UserRole.OWNER) {
      const building = await buildingRepo().findOne({ where: { id: buildingId, owner_id: id } });
      if (!building) return res.status(403).json({ message: "Bạn không có quyền xem hợp đồng này" });
    } else if (role === UserRole.MANAGER) {
      const assignment = await managerRepo().findOne({ where: { manager_id: id, building_id: buildingId } });
      if (!assignment) return res.status(403).json({ message: "Bạn không có quyền xem hợp đồng này" });
    }

    res.json(contract);
  } catch (error) {
    console.error("Get contract error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

export default router;
