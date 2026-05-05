import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Room } from "./Room";
import { User } from "./User";

@Entity("consumption_records")
export class ConsumptionRecord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  room_id!: string;

  @ManyToOne(() => Room)
  @JoinColumn({ name: "room_id" })
  room!: Room;

  @Column()
  fee_id!: string; // matches fee_id in building fee_configs

  @Column()
  billing_period!: string; // e.g. "2026-05"

  @Column({ type: "int", default: 0 })
  start_index!: number;

  @Column({ type: "int", default: 0 })
  end_index!: number;

  @Column({ type: "int", default: 0 })
  usage_amount!: number;

  @Column()
  recorded_by!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "recorded_by" })
  recorder!: User;

  @CreateDateColumn()
  created_at!: Date;
}
