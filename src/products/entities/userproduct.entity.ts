import { User } from '../../users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { Order } from '../../payment/entities/order.entity';

@Entity()
export class UserProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, name: 'user_id' })
  userId: number;

  @Column({ name: 'product_id' })
  productId: number;

  // WEB3 for unique id.
  @Column({ type: 'varchar', length: '255', name: 'token_id' })
  tokenId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.userProducts)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Order, (order) => order.userProducts)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Product, (product) => product.userProducts)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
