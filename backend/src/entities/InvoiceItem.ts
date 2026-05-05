import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Invoice } from "./Invoice";

@Entity("invoice_items")
export class InvoiceItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  invoice_id!: string;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: "invoice_id" })
  invoice!: Invoice;

  @Column({ nullable: true })
  fee_id!: string; // null for base rent line

  @Column()
  description!: string;

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  amount!: number;
}
