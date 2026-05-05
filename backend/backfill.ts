import { AppDataSource } from "./src/data-source";
import { Room } from "./src/entities/Room";
import { Building } from "./src/entities/Building";
import { Floor } from "./src/entities/Floor";

async function run() {
  await AppDataSource.initialize();
  const roomRepo = AppDataSource.getRepository(Room);
  const floorRepo = AppDataSource.getRepository(Floor);
  const buildingRepo = AppDataSource.getRepository(Building);

  const rooms = await roomRepo.find();
  let count = 0;
  for (const room of rooms) {
    if (!room.service_subscriptions || room.service_subscriptions.length === 0) {
      const floor = await floorRepo.findOneBy({ id: room.floor_id });
      if (floor) {
        const building = await buildingRepo.findOneBy({ id: floor.building_id });
        if (building && building.fee_configs) {
          room.service_subscriptions = building.fee_configs.map((f: any) => ({
            fee_id: f.id,
            override_price: null
          }));
          await roomRepo.save(room);
          console.log(`Updated room ${room.name} in building ${building.name}`);
          count++;
        }
      }
    }
  }
  console.log(`Done backfilling ${count} rooms`);
  process.exit(0);
}

run().catch(console.error);
