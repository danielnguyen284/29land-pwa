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
import { syncExpiredContracts } from "./cron/contracts";
import { autoGenerateInvoices } from "./cron/billing";

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

// Bootstrap
AppDataSource.initialize()
  .then(async () => {
    console.log("Database connected successfully.");
    await seedAdmin();

    // Run expiration check on startup
    await syncExpiredContracts();
    // Run invoice generation check on startup
    await autoGenerateInvoices();
    
    // Set up hourly cron job (3600000 ms)
    setInterval(() => {
      syncExpiredContracts();
      autoGenerateInvoices();
    }, 60 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exit(1);
  });

export default app;
