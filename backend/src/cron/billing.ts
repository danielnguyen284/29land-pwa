import { AppDataSource } from "../data-source";
import { Building } from "../entities/Building";
import { generateInvoicesForBuilding } from "../services/invoiceCalculator";

export const autoGenerateInvoices = async () => {
  try {
    const buildingRepo = AppDataSource.getRepository(Building);
    
    const today = new Date();
    const currentDay = today.getDate();
    // Current billing period (YYYY-MM)
    const billingPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    // Find all buildings where today is past or equal to the invoice closing date
    // Actually, to be safe and avoid generating too early in the month if closing date is later,
    // we just check if current day is >= invoice_closing_date.
    // However, what if a building has closing date 31, and the month has 30 days?
    // Let's just find buildings where currentDay >= invoice_closing_date
    const buildings = await buildingRepo
      .createQueryBuilder("b")
      .where("b.invoice_closing_date <= :currentDay", { currentDay })
      .getMany();

    if (buildings.length === 0) {
      return;
    }

    console.log(`[Cron] Found ${buildings.length} buildings eligible for invoice generation (period: ${billingPeriod}). Processing...`);

    let totalGenerated = 0;

    for (const building of buildings) {
      // The generateInvoicesForBuilding function automatically skips rooms that already have an invoice for this period
      const results = await generateInvoicesForBuilding(building.id, billingPeriod);
      if (results.length > 0) {
        totalGenerated += results.length;
        console.log(`[Cron] Generated ${results.length} invoices for building ${building.name} (${building.id})`);
      }
    }

    if (totalGenerated > 0) {
      console.log(`[Cron] Successfully generated ${totalGenerated} invoices across all eligible buildings.`);
    }

  } catch (error) {
    console.error("[Cron] Error auto-generating invoices:", error);
  }
};
