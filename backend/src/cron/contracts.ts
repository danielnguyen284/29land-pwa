import { AppDataSource } from "../data-source";
import { Contract, ContractStatus } from "../entities/Contract";
import { Room, RoomStatus } from "../entities/Room";
import { Tenant } from "../entities/Tenant";
import { createNotification } from "../services/notificationService";
import { NotificationType } from "../entities/Notification";
import { BuildingManager } from "../entities/BuildingManager";

export const syncExpiredContracts = async () => {
  try {
    const contractRepo = AppDataSource.getRepository(Contract);
    const roomRepo = AppDataSource.getRepository(Room);
    const tenantRepo = AppDataSource.getRepository(Tenant);
    const managerRepo = AppDataSource.getRepository(BuildingManager);

    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    // Find all ACTIVE contracts whose end_date is in the past
    // Include relations to get building owner and room info for notifications
    const expiredContracts = await contractRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.room", "r")
      .leftJoinAndSelect("r.floor", "f")
      .leftJoinAndSelect("f.building", "b")
      .where("c.status = :status", { status: ContractStatus.ACTIVE })
      .andWhere("c.end_date < :today", { today: todayString })
      .getMany();

    if (expiredContracts.length === 0) {
      return;
    }

    console.log(`[Cron] Found ${expiredContracts.length} expired contracts. Processing...`);

    for (const contract of expiredContracts) {
      // Check for auto-renewal
      if (contract.auto_renew_months && !contract.is_moving_out) {
        const oldEndDate = contract.end_date;
        const date = new Date(contract.end_date);
        
        // Logic: Add X months, then set to last day of that month
        // We set to 1st of month first to avoid month-jumping edge cases (e.g. Jan 31 + 1 month)
        date.setDate(1); 
        date.setMonth(date.getMonth() + contract.auto_renew_months);
        
        // Get last day of the resulting month
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const newEndDateString = lastDay.toISOString().split("T")[0];
        
        contract.end_date = newEndDateString;
        // Keep status as ACTIVE
        await contractRepo.save(contract);
        
        console.log(`[Cron] Contract ${contract.id} auto-renewed for ${contract.auto_renew_months} months. ${oldEndDate} -> ${newEndDateString}`);

        // --- Send Notifications ---
        const building = contract.room?.floor?.building;
        if (building) {
          const title = "Hợp đồng tự động gia hạn";
          const content = `Hợp đồng phòng ${contract.room.name} (${building.name}) đã được tự động gia hạn thêm ${contract.auto_renew_months} tháng. Hạn mới: ${newEndDateString}`;
          
          // 1. Notify Owners
          const ownerRepo = AppDataSource.getRepository("BuildingOwner");
          const ownerships = await ownerRepo.find({ where: { building_id: building.id } });
          
          const notifyOwnerIds = new Set<string>();
          if (building.owner_id) notifyOwnerIds.add(building.owner_id);
          ownerships.forEach((o: any) => notifyOwnerIds.add(o.owner_id));
          
          for (const oid of notifyOwnerIds) {
            await createNotification(oid, title, content, NotificationType.CONTRACT_RENEWED, { 
              url: `/contracts/${contract.id}`,
              contract_id: contract.id 
            });
          }
          
          // 2. Notify Managers
          const managers = await managerRepo.find({ where: { building_id: building.id } });
          for (const m of managers) {
            await createNotification(m.manager_id, title, content, NotificationType.CONTRACT_RENEWED, { 
              url: `/contracts/${contract.id}`,
              contract_id: contract.id 
            });
          }
        }
        
        continue; // Skip the normal expiration logic
      }

      // --- Normal Expiration Logic ---
      // 1. Mark contract as EXPIRED
      contract.status = ContractStatus.EXPIRED;
      await contractRepo.save(contract);

      // 2. Mark room as EMPTY
      await roomRepo.update(contract.room_id, { status: RoomStatus.EMPTY });

      // 3. Mark all tenants in the room as INACTIVE
      await tenantRepo.update({ room_id: contract.room_id }, { status: "INACTIVE" });
      
      console.log(`[Cron] Contract ${contract.id} expired. Room ${contract.room_id} emptied. Tenants set to INACTIVE.`);
    }

  } catch (error) {
    console.error("[Cron] Error syncing expired contracts:", error);
  }
};

export const syncFutureContracts = async () => {
  try {
    const contractRepo = AppDataSource.getRepository(Contract);
    const roomRepo = AppDataSource.getRepository(Room);
    const tenantRepo = AppDataSource.getRepository(Tenant);

    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    // Find all NEW contracts whose start_date has arrived or passed
    const futureContracts = await contractRepo
      .createQueryBuilder("c")
      .where("c.status = :status", { status: ContractStatus.NEW })
      .andWhere("c.start_date <= :today", { today: todayString })
      .getMany();

    if (futureContracts.length === 0) {
      return;
    }

    console.log(`[Cron] Found ${futureContracts.length} future contracts to activate. Syncing...`);

    for (const contract of futureContracts) {
      // 1. Mark contract as ACTIVE
      contract.status = ContractStatus.ACTIVE;
      await contractRepo.save(contract);

      // 2. Mark room as OCCUPIED
      await roomRepo.update(contract.room_id, { status: RoomStatus.OCCUPIED });

      // 3. Ensure all tenants in the contract are ACTIVE (representative is already active on creation, but good for consistency)
      await tenantRepo.update({ contract_id: contract.id }, { status: "ACTIVE" });
      
      console.log(`[Cron] Contract ${contract.id} activated. Room ${contract.room_id} occupied.`);
    }

  } catch (error) {
    console.error("[Cron] Error syncing future contracts:", error);
  }
};
