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
import { User } from "./User";

export enum TicketStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  NEEDS_EXPLANATION = "NEEDS_EXPLANATION",
  COMPLETED = "COMPLETED",
  OVERDUE = "OVERDUE",
}

@Entity("tickets")
export class Ticket {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  room_id!: string;

  @ManyToOne(() => Room)
  @JoinColumn({ name: "room_id" })
  room!: Room;

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

  @Column({ type: "enum", enum: TicketStatus, default: TicketStatus.PENDING })
  status!: TicketStatus;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
