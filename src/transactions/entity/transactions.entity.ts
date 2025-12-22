import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../payment/entities/order.entity';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  fees: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'net_amount' })
  netAmount: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'association_id' })
  association: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ default: false, name: 'is_payout' })
  isPayout: boolean;

  @Column({ nullable: true, name: 'payout_date' })
  payoutDate: Date;

  @Column({ default: 'completed' })
  status: string;
}
