import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity("buildings")
export class Building {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  owner_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "owner_id" })
  owner!: User;

  @Column()
  name!: string;

  @Column({ nullable: true })
  address!: string;

  @Column({ nullable: true })
  province!: string;

  @Column({ nullable: true })
  district!: string;

  @Column({ nullable: true })
  ward!: string;

  @Column({ nullable: true })
  payment_qr_code!: string;

  @Column({ type: "int", default: 1 })
  invoice_closing_date!: number;

  @Column({ type: "int", nullable: true })
  payment_deadline_date!: number;

  @Column({ nullable: true })
  building_type!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @Column({ type: "jsonb", default: [] })
  fee_configs!: Array<{
    id: string;
    name: string;
    type: "FIXED" | "CONSUMPTION" | "PER_CAPITA";
    unit_price: number;
  }>;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
