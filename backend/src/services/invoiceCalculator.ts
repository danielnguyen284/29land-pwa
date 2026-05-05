import { AppDataSource } from "../data-source";
import { Room } from "../entities/Room";
import { Building } from "../entities/Building";
import { Floor } from "../entities/Floor";
import { Contract, ContractStatus } from "../entities/Contract";
import { ConsumptionRecord } from "../entities/ConsumptionRecord";
import { Invoice, InvoiceStatus } from "../entities/Invoice";
import { InvoiceItem } from "../entities/InvoiceItem";
import { Tenant } from "../entities/Tenant";

interface GeneratedInvoice {
  invoice: Invoice;
  items: InvoiceItem[];
}

/**
 * Generate an invoice for a single room for a given billing period.
 *
 * Calculation:
 *   1. Room base_rent
 *   2. + Fixed fees from service_subscriptions (override_price or building default)
 *   3. + Consumption fees from ConsumptionRecords for this period
 *   4. +/- Rolling balance from previous invoice
 *   = Total
 */
export async function generateInvoiceForRoom(
  room: Room,
  building: Building,
  billingPeriod: string // "YYYY-MM"
): Promise<GeneratedInvoice | null> {
  const contractRepo = AppDataSource.getRepository(Contract);
  const consumptionRepo = AppDataSource.getRepository(ConsumptionRecord);
  const invoiceRepo = AppDataSource.getRepository(Invoice);
  const itemRepo = AppDataSource.getRepository(InvoiceItem);
  const tenantRepo = AppDataSource.getRepository(Tenant);

  // Find active contract for this room
  const contract = await contractRepo.findOneBy({
    room_id: room.id,
    status: ContractStatus.ACTIVE,
  });
  if (!contract) return null; // no active contract, skip

  // Check if invoice already exists for this period
  const existingInvoices = await invoiceRepo.find({
    where: {
      room_id: room.id,
      billing_period: billingPeriod,
    }
  });

  let existing = existingInvoices.length > 0 ? existingInvoices[0] : null;

  if (existingInvoices.length > 0) {
    // Only allow recalculation if ALL existing invoices are UNPAID
    const hasPaid = existingInvoices.some(i => i.status !== InvoiceStatus.UNPAID);
    if (hasPaid) {
      return null;
    }
    
    // Clear old items for ALL existing invoices
    for (const inv of existingInvoices) {
      await itemRepo.delete({ invoice_id: inv.id });
    }

    // Keep the first one, delete the rest to fix any duplicate records
    if (existingInvoices.length > 1) {
      await invoiceRepo.remove(existingInvoices.slice(1));
    }
  }

  // Build fee lookup from building config
  const feeMap = new Map<string, { name: string; type: string; unit_price: number }>();
  for (const fee of building.fee_configs) {
    feeMap.set(fee.id, fee);
  }

  const items: Partial<InvoiceItem>[] = [];

  // 1. Base rent
  const rentAmount = Number(room.base_rent) || 0;
  items.push({
    fee_id: undefined,
    description: "Tiền phòng",
    amount: rentAmount,
  });

  // 2. Service subscriptions (FIXED + CONSUMPTION + PER_CAPITA)
  let fixedTotal = 0;
  let consumptionTotal = 0;
  let perCapitaTotal = 0;

  for (const sub of room.service_subscriptions) {
    const isCustom = sub.fee_id.startsWith("custom_");
    const feeDef = isCustom ? { name: sub.name || "Phí dịch vụ khác", type: sub.type || "FIXED", unit_price: 0 } : feeMap.get(sub.fee_id);
    if (!feeDef) continue;

    const price = sub.override_price !== null && sub.override_price !== undefined
      ? Number(sub.override_price)
      : Number(feeDef.unit_price);

    if (feeDef.type === "FIXED") {
      items.push({
        fee_id: sub.fee_id,
        description: feeDef.name,
        amount: price,
      });
      fixedTotal += price;
    } else if (feeDef.type === "PER_CAPITA") {
      const occupantCount = await tenantRepo.countBy({
        room_id: room.id,
        status: "ACTIVE",
      });
      const cost = occupantCount * price;
      items.push({
        fee_id: sub.fee_id,
        description: `${feeDef.name}: ${occupantCount} người x ${price.toLocaleString()}`,
        amount: cost,
      });
      perCapitaTotal += cost;
    } else if (feeDef.type === "CONSUMPTION") {
      // Look up consumption record for this period
      const record = await consumptionRepo.findOneBy({
        room_id: room.id,
        fee_id: sub.fee_id,
        billing_period: billingPeriod,
      });

      if (record) {
        const usage = Number(record.usage_amount);
        const cost = usage * price;
        items.push({
          fee_id: sub.fee_id,
          description: `${feeDef.name}: ${record.start_index} → ${record.end_index} = ${usage} x ${price.toLocaleString()}`,
          amount: cost,
        });
        consumptionTotal += cost;
      }
    }
  }

  // 3. Rolling balance from previous invoice
  const previousInvoice = await invoiceRepo
    .createQueryBuilder("inv")
    .where("inv.room_id = :roomId", { roomId: room.id })
    .andWhere("inv.billing_period < :period", { period: billingPeriod })
    .orderBy("inv.billing_period", "DESC")
    .getOne();

  let rollingBalance = 0;
  if (previousInvoice) {
    const prevTotal = Number(previousInvoice.total_amount);
    const prevPaid = Number(previousInvoice.paid_amount);
    rollingBalance = prevTotal - prevPaid; // positive = debt, negative = overpaid
  }

  // 4. Calculate total
  const subtotal = rentAmount + fixedTotal + consumptionTotal + perCapitaTotal;
  const totalAmount = subtotal + rollingBalance;

  // Create or Update invoice
  let invoice: Invoice;
  if (existing) {
    invoice = existing;
    invoice.rent_amount = rentAmount;
    invoice.rolling_balance = rollingBalance;
    invoice.total_amount = totalAmount;
    invoice.issue_date = new Date().toISOString().split("T")[0]; // Optionally update issue_date
  } else {
    invoice = invoiceRepo.create({
      room_id: room.id,
      contract_id: contract.id,
      billing_period: billingPeriod,
      issue_date: new Date().toISOString().split("T")[0],
      rent_amount: rentAmount,
      rolling_balance: rollingBalance,
      total_amount: totalAmount,
      paid_amount: 0,
      status: InvoiceStatus.UNPAID,
    });
  }

  const savedInvoice = await invoiceRepo.save(invoice);

  // Create invoice items
  const savedItems: InvoiceItem[] = [];
  for (const item of items) {
    const invoiceItem = itemRepo.create({
      ...item,
      invoice_id: savedInvoice.id,
    });
    savedItems.push(await itemRepo.save(invoiceItem));
  }

  // Add rolling balance as a line item if non-zero
  if (rollingBalance !== 0) {
    const balanceItem = itemRepo.create({
      invoice_id: savedInvoice.id,
      fee_id: undefined,
      description: rollingBalance > 0 ? "Công nợ kỳ trước" : "Dư kỳ trước",
      amount: rollingBalance,
    });
    savedItems.push(await itemRepo.save(balanceItem));
  }

  return { invoice: savedInvoice, items: savedItems };
}

/**
 * Generate invoices for ALL occupied rooms in a building.
 */
export async function generateInvoicesForBuilding(
  buildingId: string,
  billingPeriod: string
): Promise<GeneratedInvoice[]> {
  const floorRepo = AppDataSource.getRepository(Floor);
  const roomRepo = AppDataSource.getRepository(Room);
  const buildingRepo = AppDataSource.getRepository(Building);

  const building = await buildingRepo.findOneBy({ id: buildingId });
  if (!building) return [];

  const floors = await floorRepo.findBy({ building_id: buildingId });
  const floorIds = floors.map((f) => f.id);
  if (floorIds.length === 0) return [];

  const rooms = await roomRepo
    .createQueryBuilder("r")
    .where("r.floor_id IN (:...floorIds)", { floorIds })
    .andWhere("r.status = :status", { status: "OCCUPIED" })
    .getMany();

  const results: GeneratedInvoice[] = [];
  for (const room of rooms) {
    const result = await generateInvoiceForRoom(room, building, billingPeriod);
    if (result) results.push(result);
  }

  return results;
}
