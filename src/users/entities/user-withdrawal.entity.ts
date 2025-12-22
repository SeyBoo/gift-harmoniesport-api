import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { UserTransaction } from './user-transaction.entity';

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}
export const UPLOAD_WITHDRAWAL_INVOICE_LIMIT: number = 5 * 1024 * 1024; // 5mb

@Index(['userId', 'status'])
@Entity()
export class UserWithdrawal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  amount: number;

  @Column({ type: 'enum', enum: WithdrawalStatus, name: 'status' })
  status: WithdrawalStatus;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'receipt_id' })
  receiptId: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'invoice_url' })
  invoiceUrl: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'reject_reason',
  })
  rejectReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => UserTransaction, (transaction) => transaction.userWithdrawal)
  userTransaction: UserTransaction[];
}
