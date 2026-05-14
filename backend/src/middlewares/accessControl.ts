import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { User, UserRole } from "../entities/User";
import { Ticket } from "../entities/Ticket";
import { AppDataSource } from "../data-source";
import { Building } from "../entities/Building";
import { BuildingManager } from "../entities/BuildingManager";
import { BuildingOwner } from "../entities/BuildingOwner";

export const requireBuildingAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role === UserRole.ADMIN) return next();
  
  const buildingId = req.params.id || req.body.building_id || req.query.building_id;
  if (!buildingId) return res.status(400).json({ message: "Thiếu ID tòa nhà" });

  const buildingRepo = AppDataSource.getRepository(Building);
  const managerRepo = AppDataSource.getRepository(BuildingManager);

  if (req.user.role === UserRole.OWNER) {
    const building = await buildingRepo.findOneBy({ id: buildingId as string });
    const ownerRepo = AppDataSource.getRepository(BuildingOwner);
    const ownership = await ownerRepo.findOneBy({ building_id: buildingId as string, owner_id: req.user.id });

    if (!building || (!ownership && building.owner_id !== req.user.id)) { 
      return res.status(403).json({ message: "Không có quyền truy cập tòa nhà này" }); 
    }
    return next();
  }

  if (req.user.role === UserRole.MANAGER) {
    const assignment = await managerRepo.findOneBy({ 
      building_id: buildingId as string, 
      manager_id: req.user.id 
    });
    if (!assignment) {
      return res.status(403).json({ message: "Không có quyền quản lý tòa nhà này" });
    }
    return next();
  }

  res.status(403).json({ message: "Không có quyền" });
};

export const requireTicketAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role === UserRole.ADMIN) return next();

  const ticketId = req.params.id;
  if (!ticketId) return res.status(400).json({ message: "Thiếu ID phiếu" });

  const ticketRepo = AppDataSource.getRepository(Ticket);
  const ticket = await ticketRepo.findOne({
    where: { id: ticketId as string },
    relations: ["building"]
  });

  if (!ticket) return res.status(404).json({ message: "Không tìm thấy phiếu" });

  // Technician access
  if (req.user.role === UserRole.TECHNICIAN) {
    if (ticket.assigned_tech_id === req.user.id) return next();
    return res.status(403).json({ message: "Bạn không có quyền truy cập phiếu này" });
  }

  // Owner access
  if (req.user.role === UserRole.OWNER) {
    const ownerRepo = AppDataSource.getRepository(BuildingOwner);
    const ownership = await ownerRepo.findOneBy({ building_id: ticket.building_id, owner_id: req.user.id });

    if (ownership || ticket.building?.owner_id === req.user.id) {
      // Owners only see tickets that are WAITING_APPROVAL or COMPLETED
      const visibleStatuses = ["WAITING_APPROVAL", "COMPLETED"];
      if (visibleStatuses.includes(ticket.status)) return next();
      return res.status(403).json({ message: "Phiếu này chưa được gửi cho bạn" });
    }
    return res.status(403).json({ message: "Bạn không có quyền truy cập phiếu này" });
  }

  // Manager access
  if (req.user.role === UserRole.MANAGER) {
    const managerRepo = AppDataSource.getRepository(BuildingManager);
    const assignment = await managerRepo.findOneBy({ 
      building_id: ticket.building_id, 
      manager_id: req.user.id 
    });
    if (assignment) return next();
    return res.status(403).json({ message: "Bạn không có quyền truy cập phiếu này" });
  }

  res.status(403).json({ message: "Không có quyền" });
};

export const requireExpenseAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role === UserRole.ADMIN) return next();

  const expenseId = req.params.expenseId;
  if (!expenseId) return res.status(400).json({ message: "Thiếu ID khoản chi" });

  const expenseRepo = AppDataSource.getRepository("TicketExpense");
  const expense = await expenseRepo.findOne({
    where: { id: expenseId as string },
    relations: ["ticket", "ticket.building"]
  }) as any;

  if (!expense) return res.status(404).json({ message: "Không tìm thấy khoản chi" });

  const ticket = expense.ticket;

  // Technician access
  if (req.user.role === UserRole.TECHNICIAN) {
    if (ticket.assigned_tech_id === req.user.id) return next();
    return res.status(403).json({ message: "Bạn không có quyền truy cập khoản chi này" });
  }

  // Owner access
  if (req.user.role === UserRole.OWNER) {
    const ownerRepo = AppDataSource.getRepository(BuildingOwner);
    const ownership = await ownerRepo.findOneBy({ building_id: ticket.building_id, owner_id: req.user.id });

    if (ownership || ticket.building?.owner_id === req.user.id) {
      // Owners only see expenses of tickets that are WAITING_APPROVAL or COMPLETED
      const visibleStatuses = ["WAITING_APPROVAL", "COMPLETED"];
      if (visibleStatuses.includes(ticket.status)) return next();
      return res.status(403).json({ message: "Khoản chi này chưa được gửi cho bạn" });
    }
    return res.status(403).json({ message: "Bạn không có quyền truy cập khoản chi này" });
  }

  // Manager access
  if (req.user.role === UserRole.MANAGER) {
    const managerRepo = AppDataSource.getRepository(BuildingManager);
    const assignment = await managerRepo.findOneBy({ 
      building_id: ticket.building_id, 
      manager_id: req.user.id 
    });
    if (assignment) return next();
    return res.status(403).json({ message: "Bạn không có quyền truy cập khoản chi này" });
  }

  res.status(403).json({ message: "Không có quyền" });
};
