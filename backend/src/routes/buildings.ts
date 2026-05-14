import { Router, Response, NextFunction } from "express";
import { AppDataSource } from "../data-source";
import { Building } from "../entities/Building";
import { BuildingManager } from "../entities/BuildingManager";
import { BuildingOwner } from "../entities/BuildingOwner";
import { RoomClass } from "../entities/RoomClass";
import { Floor } from "../entities/Floor";
import { Room } from "../entities/Room";
import { User, UserRole } from "../entities/User";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";
import { requireBuildingAccess } from "../middlewares/accessControl";
import { In, ILike } from "typeorm";

const router = Router();
const buildingRepo = () => AppDataSource.getRepository(Building);
const managerRepo = () => AppDataSource.getRepository(BuildingManager);
const ownerRepo = () => AppDataSource.getRepository(BuildingOwner);
const classRepo = () => AppDataSource.getRepository(RoomClass);
const floorRepo = () => AppDataSource.getRepository(Floor);

router.use(authenticate);

// Middleware to check if OWNER actually owns the building (For Write operations)
const requireBuildingOwnership = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user!.role === UserRole.ADMIN) return next();
  if (req.user!.role === UserRole.OWNER) {
    const building = await buildingRepo().findOneBy({ id: req.params.id as string });
    if (!building) { res.status(404).json({ message: "Không tìm thấy tòa nhà" }); return; }
    const ownership = await ownerRepo().findOneBy({ building_id: building.id, owner_id: req.user!.id });
    if (!ownership && building.owner_id !== req.user!.id) { res.status(403).json({ message: "Không có quyền" }); return; }
    return next();
  }
  res.status(403).json({ message: "Không có quyền" });
};

// ─── Buildings CRUD ───

// GET /api/buildings — Owner sees own, Manager sees assigned, Admin sees all
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { role, id } = req.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;

    const search = req.query.search as string;
    let whereClause: any = {};

    if (role === UserRole.ADMIN) {
      whereClause = {};
    } else if (role === UserRole.OWNER) {
      const ownerships = await ownerRepo().find({ where: { owner_id: id } });
      const ids = ownerships.map((o) => o.building_id);
      if (ids.length > 0) {
        whereClause = [
          { id: In(ids), ...(search ? { name: ILike(`%${search}%`) } : {}) },
          { owner_id: id, ...(search ? { name: ILike(`%${search}%`) } : {}) }
        ];
      } else {
        whereClause = { owner_id: id, ...(search ? { name: ILike(`%${search}%`) } : {}) };
      }
    } else if (role === UserRole.MANAGER) {
      const assignments = await managerRepo().find({ where: { manager_id: id } });
      const ids = assignments.map((a) => a.building_id);
      if (ids.length === 0) { 
        res.json({ data: [], meta: { total: 0, page, limit, totalPages: 0 } }); 
        return; 
      }
      whereClause = { id: In(ids) };
    } else {
      res.json({ data: [], meta: { total: 0, page, limit, totalPages: 0 } });
      return;
    }

    if (search && role !== UserRole.OWNER) {
      whereClause.name = ILike(`%${search}%`);
    }

    const [buildings, total] = await buildingRepo().findAndCount({
      where: whereClause,
      order: { created_at: "DESC" },
      skip,
      take: limit
    });

    if (buildings.length > 0) {
      const buildingIds = buildings.map(b => `'${b.id}'`).join(',');
      const roomCounts = await AppDataSource.query(`
        SELECT f.building_id, COUNT(r.id) as count
        FROM floors f
        INNER JOIN rooms r ON r.floor_id = f.id
        WHERE f.building_id IN (${buildingIds})
        GROUP BY f.building_id
      `);
      
      const countMap = new Map();
      roomCounts.forEach((row: any) => countMap.set(row.building_id, parseInt(row.count, 10)));
      
      const ownerships = await ownerRepo().find({ where: { building_id: In(buildings.map(b => b.id)) }, relations: ["owner"] });
      const ownersMap = new Map<string, any[]>();
      ownerships.forEach(o => {
        if (!ownersMap.has(o.building_id)) ownersMap.set(o.building_id, []);
        ownersMap.get(o.building_id)!.push({ id: o.owner.id, name: o.owner.name, phone: o.owner.phone, payment_qr_code: o.owner.payment_qr_code });
      });

      const result = buildings.map(b => {
        let owners = ownersMap.get(b.id) || [];
        // Fallback for old owner_id
        if (owners.length === 0 && b.owner_id) {
          // It's a list view, so we don't fully fetch old owner details to avoid N+1 if not populated
          // But it's fine for now, we just pass what we can or leave it. We will fetch if needed.
        }
        
        const item = {
          ...b,
          owners,
          rooms_count: countMap.get(b.id) || 0
        };
        if (role !== UserRole.ADMIN && role !== UserRole.OWNER) {
          delete (item as any).lease_start_date;
          delete (item as any).lease_term_years;
        }
        return item;
      });
      
      res.json({
        data: result,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      });
      return;
    }

    res.json({
      data: buildings,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error("List buildings error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/buildings (Admin)
router.post("/", requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      name, address, province, district, ward, 
      invoice_closing_date, payment_deadline_date, building_type, description,
      fee_configs, owner_id, owner_ids, manager_ids, floors, room_classes, payment_qr_code,
      lease_start_date, lease_term_years
    } = req.body;
    if (!name) { res.status(400).json({ message: "Tên tòa nhà là bắt buộc" }); return; }

    await AppDataSource.transaction(async (transactionalEntityManager) => {
      let actualOwnerIds: string[] = [];
      if (req.user!.role === UserRole.ADMIN) {
        if (owner_ids && Array.isArray(owner_ids) && owner_ids.length > 0) {
          actualOwnerIds = owner_ids;
        } else if (owner_id) {
          actualOwnerIds = [owner_id];
        } else {
          actualOwnerIds = [req.user!.id];
        }
      } else {
        actualOwnerIds = [req.user!.id];
      }

      const building = transactionalEntityManager.create(Building, {
        name,
        address,
        province,
        district,
        ward,
        owner_id: actualOwnerIds[0],
        invoice_closing_date: invoice_closing_date || 1,
        payment_deadline_date: payment_deadline_date || null,
        building_type: building_type || null,
        description: description || null,
        fee_configs: fee_configs || [],
        payment_qr_code: payment_qr_code || null,
        lease_start_date: lease_start_date || null,
        lease_term_years: lease_term_years || null,
      });

      const savedBuilding = await transactionalEntityManager.save(building);

      for (const oid of actualOwnerIds) {
        const ownership = transactionalEntityManager.create(BuildingOwner, {
          building_id: savedBuilding.id,
          owner_id: oid,
        });
        await transactionalEntityManager.save(ownership);
      }

      if (manager_ids && Array.isArray(manager_ids)) {
        for (const manager_id of manager_ids) {
          const assignment = transactionalEntityManager.create(BuildingManager, {
            building_id: savedBuilding.id,
            manager_id,
          });
          await transactionalEntityManager.save(assignment);
        }
      }

      const classIdMap = new Map<string, string>();
      if (room_classes && Array.isArray(room_classes)) {
        for (const rc of room_classes) {
          const roomClass = transactionalEntityManager.create(RoomClass, {
            building_id: savedBuilding.id,
            name: rc.name,
            default_base_rent: rc.default_base_rent,
          });
          const savedRc = await transactionalEntityManager.save(roomClass);
          classIdMap.set(rc.id, savedRc.id);
        }
      }

      if (floors && Array.isArray(floors)) {
        for (const floorData of floors) {
          const floor = transactionalEntityManager.create(Floor, {
            building_id: savedBuilding.id,
            name: `Tầng ${floorData.floor_number}`,
          });
          const savedFloor = await transactionalEntityManager.save(floor);

          if (floorData.rooms && Array.isArray(floorData.rooms)) {
            for (const roomData of floorData.rooms) {
              const actualRoomClassId = roomData.room_class_id ? classIdMap.get(roomData.room_class_id) : null;

              const defaultSubscriptions = (fee_configs || []).map((f: any) => ({
                fee_id: f.id,
                override_price: null,
              }));

              const room = transactionalEntityManager.create(Room, {
                floor_id: savedFloor.id,
                name: roomData.name,
                base_rent: roomData.base_rent,
                area: roomData.area,
                room_class_id: actualRoomClassId || undefined,
                service_subscriptions: roomData.service_subscriptions !== undefined ? roomData.service_subscriptions : defaultSubscriptions,
              });
              await transactionalEntityManager.save(room);
            }
          }
        }
      }

      res.status(201).json(savedBuilding);
    });
  } catch (error) {
    console.error("Create building error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// GET /api/buildings/:id
router.get("/:id", requireBuildingAccess, async (req: AuthRequest, res: Response) => {
  try {
    const building = await buildingRepo().findOne({
      where: { id: req.params.id as string }
    });
    if (!building) { res.status(404).json({ message: "Không tìm thấy tòa nhà" }); return; }

    const ownerships = await ownerRepo().find({ where: { building_id: building.id }, relations: ["owner"] });
    let owners: { id: string; name: string; phone: string; payment_qr_code?: string }[] = [];
    if (ownerships.length > 0) {
      owners = ownerships.map(o => ({ id: o.owner.id, name: o.owner.name, phone: o.owner.phone, payment_qr_code: o.owner.payment_qr_code }));
    } else if (building.owner_id) {
      const userRepo = AppDataSource.getRepository(User);
      const oldOwner = await userRepo.findOneBy({ id: building.owner_id });
      if (oldOwner) {
        owners = [{ id: oldOwner.id, name: oldOwner.name, phone: oldOwner.phone, payment_qr_code: oldOwner.payment_qr_code }];
      }
    }

    // Fetch managers via pivot table
    const assignments = await managerRepo().find({ where: { building_id: building.id } });
    let managers: { id: string; name: string; phone: string }[] = [];
    if (assignments.length > 0) {
      const managerIds = assignments.map(a => a.manager_id);
      const userRepo = AppDataSource.getRepository(User);
      const managerUsers = await userRepo.find({ where: { id: In(managerIds) } });
      managers = managerUsers.map(u => ({ id: u.id, name: u.name, phone: u.phone }));
    }

    if (req.user!.role !== UserRole.ADMIN && req.user!.role !== UserRole.OWNER) {
      delete (building as any).lease_start_date;
      delete (building as any).lease_term_years;
    }

    res.json({ ...building, managers, owners });
  } catch (error) {
    console.error("Get building error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// GET /api/buildings/:id/managers
router.get("/:id/managers", requireBuildingAccess, async (req: AuthRequest, res: Response) => {
  try {
    const assignments = await managerRepo().find({ where: { building_id: req.params.id as string } });
    if (assignments.length === 0) {
      res.json([]);
      return;
    }
    const managerIds = assignments.map(a => a.manager_id);
    const userRepo = AppDataSource.getRepository(User);
    const managerUsers = await userRepo.find({ where: { id: In(managerIds) } });
    res.json(managerUsers);
  } catch (error) {
    console.error("Get building managers error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/buildings/:id
router.patch("/:id", requireRole(UserRole.ADMIN, UserRole.OWNER), requireBuildingOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const building = await buildingRepo().findOneBy({ id: req.params.id as string });
    if (!building) { res.status(404).json({ message: "Không tìm thấy tòa nhà" }); return; }

    const { name, address, province, district, ward, invoice_closing_date, fee_configs, payment_qr_code, owner_id, owner_ids, manager_ids } = req.body;
    
    if (req.user!.role === UserRole.ADMIN) {
      if (owner_ids && Array.isArray(owner_ids) && owner_ids.length > 0) {
        building.owner_id = owner_ids[0];
      } else if (owner_id !== undefined) {
        building.owner_id = owner_id;
      }
    }

    if (req.body.name !== undefined) building.name = req.body.name;
    if (req.body.address !== undefined) building.address = req.body.address;
    if (req.body.province !== undefined) building.province = req.body.province;
    if (req.body.district !== undefined) building.district = req.body.district;
    if (req.body.ward !== undefined) building.ward = req.body.ward;
    if (req.body.invoice_closing_date !== undefined) building.invoice_closing_date = req.body.invoice_closing_date;
    if (req.body.payment_deadline_date !== undefined) building.payment_deadline_date = req.body.payment_deadline_date;
    if (req.body.building_type !== undefined) building.building_type = req.body.building_type;
    if (req.body.description !== undefined) building.description = req.body.description;
    if (req.body.fee_configs !== undefined) building.fee_configs = req.body.fee_configs;
    if (payment_qr_code !== undefined) building.payment_qr_code = payment_qr_code;
    if (req.body.lease_start_date !== undefined) building.lease_start_date = req.body.lease_start_date === "" ? null : req.body.lease_start_date;
    if (req.body.lease_term_years !== undefined) building.lease_term_years = req.body.lease_term_years === "" ? null : req.body.lease_term_years;

    await AppDataSource.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(building);

      if (req.user!.role === UserRole.ADMIN && owner_ids && Array.isArray(owner_ids)) {
        await transactionalEntityManager.delete(BuildingOwner, { building_id: building.id });
        for (const oid of owner_ids) {
          const ownership = transactionalEntityManager.create(BuildingOwner, {
            building_id: building.id,
            owner_id: oid,
          });
          await transactionalEntityManager.save(ownership);
        }
      }

      if (manager_ids && Array.isArray(manager_ids)) {
        await transactionalEntityManager.delete(BuildingManager, { building_id: building.id });
        
        for (const manager_id of manager_ids) {
          const assignment = transactionalEntityManager.create(BuildingManager, {
            building_id: building.id,
            manager_id,
          });
          await transactionalEntityManager.save(assignment);
        }
      }
    });

    res.json(building);
  } catch (error) {
    console.error("Update building error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// DELETE /api/buildings/:id
router.delete("/:id", requireRole(UserRole.ADMIN, UserRole.OWNER), requireBuildingOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const building = await buildingRepo().findOneBy({ id: req.params.id as string });
    if (!building) { res.status(404).json({ message: "Không tìm thấy tòa nhà" }); return; }
    await buildingRepo().remove(building);
    res.json({ message: "Đã xóa tòa nhà" });
  } catch (error) {
    console.error("Delete building error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// ─── Manager Assignment ───

// GET /api/buildings/:id/managers
router.get("/:id/managers", requireBuildingAccess, async (req: AuthRequest, res: Response) => {
  try {
    const assignments = await managerRepo().find({
      where: { building_id: req.params.id as string },
      relations: ["manager"],
    });
    res.json(assignments.map((a) => ({
      id: a.manager.id,
      name: a.manager.name,
      phone: a.manager.phone,
    })));
  } catch (error) {
    console.error("List managers error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/buildings/:id/managers
router.post("/:id/managers", requireRole(UserRole.ADMIN, UserRole.OWNER), requireBuildingOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const { manager_id } = req.body;
    if (!manager_id) { res.status(400).json({ message: "manager_id là bắt buộc" }); return; }

    const existing = await managerRepo().findOneBy({
      building_id: req.params.id as string,
      manager_id,
    });
    if (existing) { res.status(409).json({ message: "Quản lý đã được gán cho tòa nhà này" }); return; }

    const assignment = managerRepo().create({
      building_id: req.params.id as string,
      manager_id,
    });
    await managerRepo().save(assignment);
    res.status(201).json({ message: "Đã gán quản lý" });
  } catch (error) {
    console.error("Assign manager error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// DELETE /api/buildings/:id/managers/:managerId
router.delete("/:id/managers/:managerId", requireRole(UserRole.ADMIN, UserRole.OWNER), requireBuildingOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const assignment = await managerRepo().findOneBy({
      building_id: req.params.id as string,
      manager_id: req.params.managerId as string,
    });
    if (!assignment) { res.status(404).json({ message: "Không tìm thấy" }); return; }
    await managerRepo().remove(assignment);
    res.json({ message: "Đã gỡ quản lý" });
  } catch (error) {
    console.error("Remove manager error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// ─── Floors ───

// GET /api/buildings/:id/floors
router.get("/:id/floors", requireBuildingAccess, async (req: AuthRequest, res: Response) => {
  try {
    const floors = await floorRepo().find({
      where: { building_id: req.params.id as string },
      order: { name: "ASC" },
    });
    res.json(floors);
  } catch (error) {
    console.error("List floors error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/buildings/:id/floors
router.post("/:id/floors", requireRole(UserRole.ADMIN, UserRole.OWNER), requireBuildingOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) { res.status(400).json({ message: "Tên tầng là bắt buộc" }); return; }

    const floor = floorRepo().create({
      building_id: req.params.id as string,
      name,
    });
    const saved = await floorRepo().save(floor);
    res.status(201).json(saved);
  } catch (error) {
    console.error("Create floor error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/buildings/:id/floors/:floorId
router.patch("/:id/floors/:floorId", requireRole(UserRole.ADMIN, UserRole.OWNER), requireBuildingOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const floor = await floorRepo().findOneBy({ id: req.params.floorId as string });
    if (!floor) { res.status(404).json({ message: "Không tìm thấy tầng" }); return; }
    if (req.body.name) floor.name = req.body.name;
    await floorRepo().save(floor);
    res.json(floor);
  } catch (error) {
    console.error("Update floor error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// DELETE /api/buildings/:id/floors/:floorId
router.delete("/:id/floors/:floorId", requireRole(UserRole.ADMIN, UserRole.OWNER), requireBuildingOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const floor = await floorRepo().findOneBy({ id: req.params.floorId as string });
    if (!floor) { res.status(404).json({ message: "Không tìm thấy tầng" }); return; }
    await floorRepo().remove(floor);
    res.json({ message: "Đã xóa tầng" });
  } catch (error) {
    console.error("Delete floor error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// ─── Room Classes ───

// GET /api/buildings/:id/room-classes
router.get("/:id/room-classes", requireBuildingAccess, async (req: AuthRequest, res: Response) => {
  try {
    const classes = await classRepo().find({
      where: { building_id: req.params.id as string },
      order: { name: "ASC" },
    });
    res.json(classes);
  } catch (error) {
    console.error("List room classes error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/buildings/:id/room-classes
router.post("/:id/room-classes", requireRole(UserRole.ADMIN, UserRole.OWNER), requireBuildingOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const { name, default_base_rent } = req.body;
    if (!name) { res.status(400).json({ message: "Tên loại phòng là bắt buộc" }); return; }

    const rc = classRepo().create({
      building_id: req.params.id as string,
      name,
      default_base_rent: default_base_rent || 0,
    });
    const saved = await classRepo().save(rc);
    res.status(201).json(saved);
  } catch (error) {
    console.error("Create room class error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/buildings/:id/room-classes/:classId
router.patch("/:id/room-classes/:classId", requireRole(UserRole.ADMIN, UserRole.OWNER), requireBuildingOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const rc = await classRepo().findOneBy({ id: req.params.classId as string });
    if (!rc) { res.status(404).json({ message: "Không tìm thấy loại phòng" }); return; }
    if (req.body.name !== undefined) rc.name = req.body.name;
    if (req.body.default_base_rent !== undefined) rc.default_base_rent = req.body.default_base_rent;
    await classRepo().save(rc);
    res.json(rc);
  } catch (error) {
    console.error("Update room class error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// DELETE /api/buildings/:id/room-classes/:classId
router.delete("/:id/room-classes/:classId", requireRole(UserRole.ADMIN, UserRole.OWNER), requireBuildingOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const rc = await classRepo().findOneBy({ id: req.params.classId as string });
    if (!rc) { res.status(404).json({ message: "Không tìm thấy loại phòng" }); return; }
    await classRepo().remove(rc);
    res.json({ message: "Đã xóa loại phòng" });
  } catch (error) {
    console.error("Delete room class error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

export default router;
