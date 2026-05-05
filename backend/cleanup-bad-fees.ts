import { AppDataSource } from "./src/data-source";
import { ConsumptionRecord } from "./src/entities/ConsumptionRecord";

async function run() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(ConsumptionRecord);

  const deleted = await repo.delete({ fee_id: "fee" });
  console.log(`Deleted ${deleted.affected} invalid consumption records`);
  
  process.exit(0);
}

run().catch(console.error);
