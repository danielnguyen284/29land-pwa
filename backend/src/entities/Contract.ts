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
import { Tenant } from "./Tenant";

export enum ContractStatus {
  NEW = "NEW",
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  TERMINATED = "TERMINATED",
}

@Entity("contracts")
export class Contract {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  room_id!: string;

  @ManyToOne(() => Room)
  @JoinColumn({ name: "room_id" })
  room!: Room;

  @Column()
  representative_tenant_id!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: "representative_tenant_id" })
  representative_tenant!: Tenant;

  @Column({ type: "date" })
  start_date!: string;

  @Column({ type: "date" })
  end_date!: string;

  @Column({ type: "date", nullable: true })
  actual_end_date!: string | null;

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  rent_amount!: number;

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  deposit_amount!: number;

  @Column({ type: "decimal", precision: 12, scale: 0, nullable: true })
  refunded_deposit!: number | null;

  @Column({ type: "enum", enum: ContractStatus, default: ContractStatus.NEW })
  status!: ContractStatus;

  @Column({ type: "jsonb", default: [] })
  document_photos!: string[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
