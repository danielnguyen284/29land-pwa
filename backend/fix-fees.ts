import { AppDataSource } from "./src/data-source";
import { Building } from "./src/entities/Building";
import { Room } from "./src/entities/Room";
import { v4 as uuidv4 } from "uuid";

async function run() {
  await AppDataSource.initialize();
  const buildingRepo = AppDataSource.getRepository(Building);
  const roomRepo = AppDataSource.getRepository(Room);

  const buildings = await buildingRepo.find();
  for (const building of buildings) {
    let changed = false;
    const oldToNewFeeId: Record<string, string> = {};
    
    // We need to match the original index to fix room subscriptions
    const newFeeConfigs = [];
    let feeIndex = 0;
    
    for (const fee of building.fee_configs || []) {
      if (!fee.id) {
        const newId = `fee_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        oldToNewFeeId[`index_${feeIndex}`] = newId;
        newFeeConfigs.push({ ...fee, id: newId });
        changed = true;
      } else {
        newFeeConfigs.push(fee);
      }
      feeIndex++;
    }

    if (changed) {
      console.log(`Fixing building ${building.id}`);
      building.fee_configs = newFeeConfigs;
      await buildingRepo.save(building);

      // Now fix rooms
      const rooms = await roomRepo.find({ 
        relations: ["floor"],
        where: { floor: { building_id: building.id } }
      });
      
      for (const room of rooms) {
        let roomChanged = false;
        const newSubs = [];
        let subIndex = 0;
        
        for (const sub of room.service_subscriptions || []) {
          if (!sub.fee_id && oldToNewFeeId[`index_${subIndex}`]) {
            newSubs.push({ ...sub, fee_id: oldToNewFeeId[`index_${subIndex}`] });
            roomChanged = true;
          } else {
            newSubs.push(sub);
          }
          subIndex++;
        }
        
        if (roomChanged) {
          room.service_subscriptions = newSubs;
          await roomRepo.save(room);
        }
      }
    }
  }
  console.log("Done");
  process.exit(0);
}

run().catch(console.error);
