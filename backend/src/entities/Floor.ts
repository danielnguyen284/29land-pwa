import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Building } from "./Building";

@Entity("floors")
export class Floor {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  building_id!: string;

  @ManyToOne(() => Building)
  @JoinColumn({ name: "building_id" })
  building!: Building;

  @Column()
  name!: string;
}
