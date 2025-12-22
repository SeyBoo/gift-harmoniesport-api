import { UserTransaction } from '../../users/entities/user-transaction.entity';
import { UserProduct } from '../../products/entities/userproduct.entity';
import { User } from '../../users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

export enum PAYMENT_STATUS {
  INTENDED = 'intended',
  FAILED = 'FAILED',
  SUCCEEDED = 'succeeded',
  REFUNDED = 'refunded',
}

export enum FISC_STATUS {
  WAITING = 'WAITING',
  REFUSED = 'REFUSED',
  COMPLETED = 'COMPLETED',
}

export enum PSP_PROVIDER_NAME {
  STRIPE = 'stripe',
  VIVA_WALLET = 'viva wallet',
}

export enum DELIVERY_STATUS {
  PENDING = 'pending',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  productType: 'magnet' | 'digital' | 'collector';
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  price: string;

  @Column({ type: 'json', nullable: true })
  items: OrderItem[];

  @Index()
  @Column({ name: 'payment_intent_id' })
  paymentIntentId: string;

  @Index()
  @Column({ unique: true, nullable: true })
  reference: string;

  @Column({ name: 'charge_id', nullable: true })
  chargeId: string;

  @Column({
    name: 'psp_provider_name',
    nullable: true,
    type: 'varchar',
    length: 255,
  })
  pspProviderName: PSP_PROVIDER_NAME;

  @Column()
  status: string;

  // Message and video
  @Column({ type: 'longtext', nullable: true })
  message?: string;

  @Column({
    type: 'json',
    nullable: true,
    name: 'multilingual_message',
  })
  multilingualMessage: Record<string, string>;

  @Column({ nullable: true })
  firstname?: string;

  @Column({ nullable: true })
  lastname?: string;

  @Column({ nullable: true })
  video?: string;

  @Column({ nullable: true, name: 'ia_thanks_video' })
  iaThanksVideo?: string;

  // Fiscal information
  @Column({ nullable: true })
  fisc_file: string;

  @Column({
    type: 'enum',
    enum: FISC_STATUS,
    default: FISC_STATUS.WAITING,
    nullable: true,
  })
  fisc_status: string;

  // Invoice information
  @Column({ nullable: true })
  invoice_phone: string;

  @Column({ nullable: true })
  invoice_address: string;

  @Column({ nullable: true })
  invoice_address_information: string;

  @Column({ nullable: true })
  invoice_postalcode: string;

  @Column({ nullable: true })
  invoice_city: string;

  @Column({ nullable: true })
  invoice_country: string;

  @Column({ nullable: true })
  invoice_state: string;

  @Column({
    name: 'invoice_url',
    nullable: true,
    default: null,
    type: 'varchar',
    length: '255',
  })
  invoiceUrl: string;

  @Column({
    name: 'invoice_id',
    nullable: true,
    default: null,
    type: 'varchar',
    length: '255',
  })
  invoiceId: string;

  // Delivery information
  @Column({
    type: 'enum',
    enum: DELIVERY_STATUS,
    default: DELIVERY_STATUS.PENDING,
  })
  delivery_status: DELIVERY_STATUS;

  @Column({ nullable: true })
  delivery_address: string;

  @Column({ nullable: true })
  delivery_address_information: string;

  @Column({ nullable: true })
  delivery_city: string;

  @Column({ nullable: true })
  delivery_postalcode: string;

  @Column({ nullable: true })
  delivery_country: string;

  @Column({ nullable: true })
  delivery_state: string;

  @Column({ nullable: true })
  delivery_phone: string;

  @Column({ nullable: true })
  tracking_number: string;

  @Column({ nullable: true })
  carrier: string;

  // Relations
  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @OneToMany(() => UserProduct, (userProduct) => userProduct.order)
  userProducts: UserProduct[];

  @OneToMany(
    () => UserTransaction,
    (userTransaction) => userTransaction.userAffiliation,
  )
  userTransactions: UserTransaction[];

  @JoinColumn({ name: 'user_id' })
  @ManyToOne(() => User, (user) => user.id)
  user: User;

  @Column({ default: false, name: 'exported' })
  exported: boolean;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
