import { Product } from '../../products/entities/product.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Offer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column({ name: 'verify_token' })
  verifyToken: string;

  @ManyToOne(() => Product, {
    onDelete: 'CASCADE',
  })
  product: Product;

  @Column({ name: 'claimed_at', nullable: true })
  claimedAt: Date;

  @Column({ name: 'sent_at', nullable: true })
  sentAt: Date;

  @Column({ name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ default: false })
  bounced: boolean;

  @Column({
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
