import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./User";
import { Building } from "./Building";

@Entity("building_owners")
export class BuildingOwner {
  @PrimaryColumn()
  owner_id!: string;

  @PrimaryColumn()
  building_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "owner_id" })
  owner!: User;

  @ManyToOne(() => Building)
  @JoinColumn({ name: "building_id" })
  building!: Building;
}
