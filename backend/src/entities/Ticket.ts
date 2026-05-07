import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Room } from "./Room";
import { Building } from "./Building";
import { User } from "./User";
import { TicketExpense } from "./TicketExpense";

export enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum TicketStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  WAITING_APPROVAL = "WAITING_APPROVAL",
  NEEDS_EXPLANATION = "NEEDS_EXPLANATION",
  COMPLETED = "COMPLETED",
  OVERDUE = "OVERDUE",
}

@Entity("tickets")
export class Ticket {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ nullable: true })
  room_id!: string;

  @ManyToOne(() => Room, { nullable: true })
  @JoinColumn({ name: "room_id" })
  room!: Room;

  @Column({ nullable: true }) // Temporarily nullable for migration, then we enforce in API
  building_id!: string;

  @ManyToOne(() => Building)
  @JoinColumn({ name: "building_id" })
  building!: Building;

  @Column()
  created_by!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  creator!: User;

  @Column({ nullable: true })
  assigned_tech_id!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "assigned_tech_id" })
  assigned_tech!: User;

  @Column()
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @Column({ type: "enum", enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority!: TicketPriority;

  @Column({ type: "jsonb", default: [] })
  evidence_photos!: string[];

  @Column({ type: "enum", enum: TicketStatus, default: TicketStatus.PENDING })
  status!: TicketStatus;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => TicketExpense, (expense) => expense.ticket)
  expenses!: TicketExpense[];
}
