import "reflect-metadata";
import { AppDataSource } from "../data-source";

async function main() {
  console.log("Initializing database connection...");
  await AppDataSource.initialize();
  console.log("Database connected.");

  // Update tickets set building_id = (select floor.building_id from rooms join floors on rooms.floor_id = floors.id where rooms.id = tickets.room_id)
  const result = await AppDataSource.query(`
    UPDATE tickets 
    SET building_id = f.building_id
    FROM rooms r
    JOIN floors f ON r.floor_id = f.id
    WHERE tickets.room_id = r.id AND tickets.building_id IS NULL
  `);

  console.log("Migration complete:", result);
  process.exit(0);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
