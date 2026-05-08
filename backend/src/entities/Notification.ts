import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { User } from "./User";

export enum NotificationType {
  TICKET_CREATED = "TICKET_CREATED",
  TICKET_ASSIGNED = "TICKET_ASSIGNED",
  TICKET_UPDATED = "TICKET_UPDATED",
  CONTRACT_EXPIRING = "CONTRACT_EXPIRING",
  CONTRACT_RENEWED = "CONTRACT_RENEWED",
  ANNOUNCEMENT = "ANNOUNCEMENT",
}

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column()
  title!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "enum", enum: NotificationType })
  type!: NotificationType;

  @Column({ type: "jsonb", nullable: true })
  data!: any;

  @Column({ default: false })
  is_read!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
