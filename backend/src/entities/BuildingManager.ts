import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./User";
import { Building } from "./Building";

@Entity("building_managers")
export class BuildingManager {
  @PrimaryColumn()
  manager_id!: string;

  @PrimaryColumn()
  building_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "manager_id" })
  manager!: User;

  @ManyToOne(() => Building)
  @JoinColumn({ name: "building_id" })
  building!: Building;
}
