import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Building } from "./Building";
import { Room } from "./Room";
import { TransactionCategory, TransactionType } from "./TransactionCategory";
import { User } from "./User";

@Entity("transactions")
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  building_id!: string;

  @ManyToOne(() => Building)
  @JoinColumn({ name: "building_id" })
  building!: Building;

  @Column({ nullable: true })
  room_id!: string;

  @ManyToOne(() => Room, { nullable: true })
  @JoinColumn({ name: "room_id" })
  room!: Room;

  @Column({ nullable: true })
  category_id!: string | null;

  @ManyToOne(() => TransactionCategory, { nullable: true })
  @JoinColumn({ name: "category_id" })
  category!: TransactionCategory | null;

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  amount!: number;

  @Column({ type: "enum", enum: TransactionType })
  type!: TransactionType;

  @Column()
  accounting_period!: string; // YYYY-MM

  @Column({ type: "text", nullable: true })
  description!: string;

  @Column({ type: "jsonb", default: [] })
  invoice_photos!: string[];

  @Column({ type: "jsonb", default: [] })
  product_photos!: string[];

  @Column()
  created_by!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  creator!: User;

  @CreateDateColumn()
  created_at!: Date;
}
