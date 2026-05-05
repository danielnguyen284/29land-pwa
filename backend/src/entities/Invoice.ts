import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Room } from "./Room";
import { Contract } from "./Contract";

export enum InvoiceStatus {
  UNPAID = "UNPAID",
  PARTIAL = "PARTIAL",
  PAID = "PAID",
}

@Entity("invoices")
export class Invoice {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  room_id!: string;

  @ManyToOne(() => Room)
  @JoinColumn({ name: "room_id" })
  room!: Room;

  @Column({ nullable: true })
  contract_id!: string;

  @ManyToOne(() => Contract, { nullable: true })
  @JoinColumn({ name: "contract_id" })
  contract!: Contract;

  @Column()
  billing_period!: string; // e.g. "2026-05"

  @Column({ type: "date" })
  issue_date!: string;

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  rent_amount!: number;

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  rolling_balance!: number; // positive = debt, negative = surplus

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  total_amount!: number;

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  paid_amount!: number;

  @Column({ type: "enum", enum: InvoiceStatus, default: InvoiceStatus.UNPAID })
  status!: InvoiceStatus;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
