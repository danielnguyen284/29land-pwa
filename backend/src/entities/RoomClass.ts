import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Building } from "./Building";

@Entity("room_classes")
export class RoomClass {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  building_id!: string;

  @ManyToOne(() => Building)
  @JoinColumn({ name: "building_id" })
  building!: Building;

  @Column()
  name!: string;

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  default_base_rent!: number;
}
