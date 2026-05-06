import "reflect-metadata";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AppDataSource } from "./data-source";
import { seedAdmin } from "./seeds/admin";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import buildingRoutes from "./routes/buildings";
import roomRoutes from "./routes/rooms";
import tenantRoutes, { globalTenantRouter } from "./routes/tenants";
import ticketRoutes from "./routes/tickets";
import reportRoutes from "./routes/reports";
import billingRoutes from "./routes/billing";
import contractRoutes from "./routes/contracts";
import uploadRoutes from "./routes/upload";
import notificationRoutes from "./routes/notifications";
import { IsNull } from "typeorm";
import { Tenant } from "./entities/Tenant";
import { Contract } from "./entities/Contract";
import { syncExpiredContracts, syncFutureContracts } from "./cron/contracts";
import { autoGenerateInvoices } from "./cron/billing";
import cron from "node-cron";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // increased for base64 image uploads

// Routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/rooms", tenantRoutes);
app.use("/api/tenants", globalTenantRouter);
app.use("/api", billingRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notifications", notificationRoutes);

// Bootstrap
AppDataSource.initialize()
  .then(async () => {
    console.log("Database connected successfully.");
    await seedAdmin();

    // Run expiration check on startup
    await syncExpiredContracts();
    // Run future check on startup
    await syncFutureContracts();
    // Run invoice generation check on startup
    await autoGenerateInvoices();
    
    // Data Migration for Tenants
    try {
      const tenantRepo = AppDataSource.getRepository(Tenant);
      const contractRepo = AppDataSource.getRepository(Contract);
      const tenantsWithoutContract = await tenantRepo.find({ where: { contract_id: IsNull() } });
      if (tenantsWithoutContract.length > 0) {
        console.log(`Found ${tenantsWithoutContract.length} tenants without contract_id. Migrating...`);
        const rooms = [...new Set(tenantsWithoutContract.map(t => t.room_id))];
        for (const roomId of rooms) {
          const latestContract = await contractRepo.findOne({
            where: { room_id: roomId },
            order: { created_at: "DESC" }
          });
          if (latestContract) {
            await tenantRepo.update(
              { room_id: roomId, contract_id: IsNull() },
              { contract_id: latestContract.id }
            );
          }
        }
        console.log("Migration complete.");
      }
    } catch (e) {
      console.error("Migration error:", e);
    }
    
    // Set up hourly cron job (3600000 ms)
    setInterval(() => {
      syncExpiredContracts();
      autoGenerateInvoices();
    }, 60 * 60 * 1000);

    // Set up daily cron job at 00:00
    cron.schedule("0 0 * * *", () => {
      syncFutureContracts();
    });

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exit(1);
  });

export default app;
