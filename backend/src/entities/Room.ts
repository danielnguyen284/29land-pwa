import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Floor } from "./Floor";
import { RoomClass } from "./RoomClass";

export enum RoomStatus {
  EMPTY = "EMPTY",
  DEPOSITED = "DEPOSITED",
  OCCUPIED = "OCCUPIED",
}

@Entity("rooms")
export class Room {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  floor_id!: string;

  @ManyToOne(() => Floor)
  @JoinColumn({ name: "floor_id" })
  floor!: Floor;

  @Column({ nullable: true })
  room_class_id!: string;

  @ManyToOne(() => RoomClass, { nullable: true })
  @JoinColumn({ name: "room_class_id" })
  room_class!: RoomClass;

  @Column()
  name!: string;

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  base_rent!: number;

  @Column({ type: "int", nullable: true })
  area!: number;

  @Column({ type: "enum", enum: RoomStatus, default: RoomStatus.EMPTY })
  status!: RoomStatus;

  @Column({ type: "jsonb", default: [] })
  fixed_furniture!: string[];

  @Column({ type: "jsonb", default: [] })
  service_subscriptions!: Array<{
    fee_id: string;
    override_price: number | null;
    name?: string;
    type?: string;
  }>;
}
