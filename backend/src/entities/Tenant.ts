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

@Entity("tenants")
export class Tenant {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  room_id!: string;

  @ManyToOne(() => Room)
  @JoinColumn({ name: "room_id" })
  room!: Room;

  @Column({ nullable: true })
  contract_id!: string;

  @ManyToOne(() => Contract)
  @JoinColumn({ name: "contract_id" })
  contract!: Contract;

  @Column()
  name!: string;

  @Column({ nullable: true })
  cccd!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({ type: "boolean", default: false })
  is_representative!: boolean;

  @Column({ default: "ACTIVE" })
  status!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
