import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Ticket } from "./Ticket";

export enum ExpenseStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

@Entity("ticket_expenses")
export class TicketExpense {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  ticket_id!: string;

  @ManyToOne(() => Ticket)
  @JoinColumn({ name: "ticket_id" })
  ticket!: Ticket;

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  amount!: number;

  @Column({ type: "text", nullable: true })
  description!: string;

  @Column({ type: "jsonb", default: [] })
  receipt_photos!: string[];

  @Column({ type: "enum", enum: ExpenseStatus, default: ExpenseStatus.PENDING })
  status!: ExpenseStatus;

  @Column({ type: "text", nullable: true })
  reject_reason!: string;

  @Column({ type: "text", nullable: true })
  technician_comment!: string;

  @Column({ nullable: true })
  created_by!: string;

  @Column({ nullable: true })
  approved_by!: string;

  @Column({ type: "timestamp", nullable: true })
  approved_at!: Date;

  @CreateDateColumn()
  created_at!: Date;
}
