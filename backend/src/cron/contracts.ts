import { AppDataSource } from "../data-source";
import { Contract, ContractStatus } from "../entities/Contract";
import { Room, RoomStatus } from "../entities/Room";
import { Tenant } from "../entities/Tenant";

export const syncExpiredContracts = async () => {
  try {
    const contractRepo = AppDataSource.getRepository(Contract);
    const roomRepo = AppDataSource.getRepository(Room);
    const tenantRepo = AppDataSource.getRepository(Tenant);

    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    // Find all ACTIVE contracts whose end_date is in the past
    const expiredContracts = await contractRepo
      .createQueryBuilder("c")
      .where("c.status = :status", { status: ContractStatus.ACTIVE })
      .andWhere("c.end_date < :today", { today: todayString })
      .getMany();

    if (expiredContracts.length === 0) {
      return;
    }

    console.log(`[Cron] Found ${expiredContracts.length} expired contracts. Syncing...`);

    for (const contract of expiredContracts) {
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
