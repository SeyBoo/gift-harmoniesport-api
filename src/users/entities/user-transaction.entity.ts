import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserAffiliation } from './user-affiliation.entity';
import { Order } from '../../payment/entities/order.entity';
import { UserWithdrawal } from './user-withdrawal.entity';

@Entity()
export class UserTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  amount: number;

  @Column({ nullable: false, name: 'user_affiliation_id' })
  userAffiliationId: number;

  @Column({ nullable: true, name: 'order_id' })
  orderId: number;

  @Column({ name: 'withdrawal_id', nullable: true })
  withdrawalId: string;

  @ManyToOne(() => UserAffiliation, (userAffiliation) => userAffiliation.id)
  @JoinColumn({ name: 'user_affiliation_id' })
  userAffiliation: UserAffiliation;

  @ManyToOne(() => Order, (order) => order.id, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => UserWithdrawal, (withdrawal) => withdrawal.id, {
    nullable: true,
  })
  @JoinColumn({ name: 'withdrawal_id' })
  userWithdrawal: UserWithdrawal;
}
