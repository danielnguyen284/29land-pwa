import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Building } from "./Building";

export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

@Entity("transaction_categories")
export class TransactionCategory {
  @PrimaryGeneratedColumn("uuid")
  id!: string;


  @Column()
  name!: string;

  @Column({ type: "enum", enum: TransactionType, default: TransactionType.EXPENSE })
  type!: TransactionType;

  @CreateDateColumn()
  created_at!: Date;
}
