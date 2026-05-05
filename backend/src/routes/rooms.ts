import { Router, Response } from "express";
import { AppDataSource } from "../data-source";
import { Room, RoomStatus } from "../entities/Room";
import { RoomClass } from "../entities/RoomClass";
import { Floor } from "../entities/Floor";
import { Building } from "../entities/Building";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";
import { UserRole } from "../entities/User";

const router = Router();
const roomRepo = () => AppDataSource.getRepository(Room);
const classRepo = () => AppDataSource.getRepository(RoomClass);

router.use(authenticate);

// GET /api/rooms?floor_id=&building_id=
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { floor_id, building_id, status } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (floor_id) where.floor_id = floor_id as string;
    if (building_id) where.floor = { building_id: building_id as string };
    if (status) where.status = status as string;

    const [rooms, total] = await roomRepo().findAndCount({
      where,
      relations: ["floor", "room_class"],
      order: { name: "ASC" },
      skip,
      take: limit
    });
    
    res.json({
      data: rooms,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error("List rooms error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// GET /api/rooms/:id
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const room = await roomRepo().findOne({
      where: { id: req.params.id as string },
      relations: ["floor", "room_class"],
    });
    if (!room) { res.status(404).json({ message: "Không tìm thấy phòng" }); return; }
    res.json(room);
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// POST /api/rooms
router.post("/", requireRole(UserRole.ADMIN, UserRole.OWNER), async (req: AuthRequest, res: Response) => {
  try {
    const { floor_id, name, room_class_id, base_rent, fixed_furniture, service_subscriptions } = req.body;
    if (!floor_id || !name) { res.status(400).json({ message: "floor_id và name là bắt buộc" }); return; }

    const floorRepo = AppDataSource.getRepository(Floor);
    const buildingRepo = AppDataSource.getRepository(Building);
    const floor = await floorRepo.findOneBy({ id: floor_id });
    if (!floor) { res.status(404).json({ message: "Không tìm thấy tầng" }); return; }

    const building = await buildingRepo.findOneBy({ id: floor.building_id });
    if (!building) { res.status(404).json({ message: "Không tìm thấy tòa nhà" }); return; }

    if (req.user!.role === UserRole.OWNER && building.owner_id !== req.user!.id) {
      res.status(403).json({ message: "Không có quyền tạo phòng ở tòa nhà này" });
      return;
    }

    let rent = base_rent || 0;
    // If room_class_id provided and no explicit base_rent, copy from class template
    if (room_class_id && !base_rent) {
      const rc = await classRepo().findOneBy({ id: room_class_id });
      if (rc) rent = rc.default_base_rent;
    }

    let subs = service_subscriptions;
    if (!subs || subs.length === 0) {
      if (building && building.fee_configs) {
        subs = building.fee_configs.map((f: any) => ({
          fee_id: f.id,
          override_price: null
        }));
      } else {
        subs = [];
      }
    }

    const room = roomRepo().create({
      floor_id,
      name,
      room_class_id: room_class_id || null,
      base_rent: rent,
      status: RoomStatus.EMPTY,
      fixed_furniture: fixed_furniture || [],
      service_subscriptions: subs,
    });

    const saved = await roomRepo().save(room);
    res.status(201).json(saved);
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// PATCH /api/rooms/:id
router.patch("/:id", requireRole(UserRole.ADMIN, UserRole.OWNER), async (req: AuthRequest, res: Response) => {
  try {
    const room = await roomRepo().findOne({
      where: { id: req.params.id as string },
      relations: ["floor"]
    });
    if (!room) { res.status(404).json({ message: "Không tìm thấy phòng" }); return; }

    if (req.user!.role === UserRole.OWNER) {
      const buildingRepo = AppDataSource.getRepository(Building);
      const building = await buildingRepo.findOneBy({ id: room.floor.building_id });
      if (building && building.owner_id !== req.user!.id) {
        res.status(403).json({ message: "Không có quyền sửa phòng này" });
        return;
      }
    }

    const { name, base_rent, status, room_class_id, fixed_furniture, service_subscriptions } = req.body;
    if (name !== undefined) room.name = name;
    if (base_rent !== undefined) room.base_rent = base_rent;
    if (status !== undefined) room.status = status;
    if (room_class_id !== undefined) room.room_class_id = room_class_id;
    if (fixed_furniture !== undefined) room.fixed_furniture = fixed_furniture;
    if (service_subscriptions !== undefined) room.service_subscriptions = service_subscriptions;

    await roomRepo().save(room);
    res.json(room);
  } catch (error) {
    console.error("Update room error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// DELETE /api/rooms/:id
router.delete("/:id", requireRole(UserRole.ADMIN, UserRole.OWNER), async (req: AuthRequest, res: Response) => {
  try {
    const room = await roomRepo().findOne({
      where: { id: req.params.id as string },
      relations: ["floor"]
    });
    if (!room) { res.status(404).json({ message: "Không tìm thấy phòng" }); return; }

    if (req.user!.role === UserRole.OWNER) {
      const buildingRepo = AppDataSource.getRepository(Building);
      const building = await buildingRepo.findOneBy({ id: room.floor.building_id });
      if (building && building.owner_id !== req.user!.id) {
        res.status(403).json({ message: "Không có quyền xóa phòng này" });
        return;
      }
    }
    await roomRepo().remove(room);
    res.json({ message: "Đã xóa phòng" });
  } catch (error) {
    console.error("Delete room error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

export default router;
