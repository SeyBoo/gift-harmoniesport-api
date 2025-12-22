import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Celebrity } from '../../celebrities/entities/celebrity.entity';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';
import { Thematic } from '../../thematics/entities/thematic.entity';

const DEFAULT_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export enum TagOption {
  AWARENESS = 'Awareness',
  FUNDRAISING = 'Fundraising',
  VOLUNTEERING = 'Volunteering',
  WORKSHOPS = 'Workshops',
  EVENTS = 'Events',
  SUPPORT = 'Support',
  INCLUSION = 'Inclusion',
  PREVENTION = 'Prevention',
  COMMUNITY = 'Community',
  TRAINING = 'Training',
  EMPOWERMENT = 'Empowerment',
  OUTREACH = 'Outreach',
  EDUCATION_PROGRAM = 'Education Program',
  MENTORSHIP = 'Mentorship',
  EMERGENCY_RELIEF = 'Emergency Relief',
  DONATION_DRIVE = 'Donation Drive',
  PROTECTION = 'Protection',
  WELLBEING = 'Well-being',
  SUSTAINABILITY = 'Sustainability',
  COLLABORATION = 'Collaboration',
}

@Entity()
export class Campaign {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  campagne_name: string;

  @Column({ default: true, name: 'handle_distribution' })
  handleDistribution: boolean;

  @Column({ nullable: true })
  date_start: Date;

  @Column({ nullable: true })
  date_end: Date;

  @Column({ type: 'longtext', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true, name: 'multilingual_description' })
  multilingualDescription: Record<string, string>;

  @Column({ nullable: true })
  banner_image: string;

  @Column({ nullable: true, name: 'custom_logo' })
  customLogo: string;

  @Column({ nullable: true, default: false })
  deleted: boolean;

  @Column({ nullable: true })
  video: string;

  @Column({
    type: 'simple-array',
    nullable: true,
  })
  tags: TagOption[];

  // **** WEB3 ATTRIBUTES **** //
  // we need to know the smart contract address associated to the campaign
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'contract_address', // for CAMELCASE
  })
  contractAddress: string;
  // for web3 implementation: we need to know the transfer topics.
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'contract_transfer_topic',
    default: DEFAULT_TRANSFER_TOPIC,
  })
  contractTransferTopic: string;
  // **** END OF WEB3 ATTRIBUTES **** //

  @ManyToMany(() => Celebrity)
  @JoinTable({
    name: 'campaign_celebrities',
    joinColumn: {
      name: 'campaign_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'celebrity_id',
      referencedColumnName: 'id',
    },
  })
  celebrities: Celebrity[];

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Product, (product) => product.campaign)
  products: Product[];

  @ManyToOne(() => Thematic)
  @JoinColumn({ name: 'thematic_id' })
  thematic: Thematic;

  @Column({
    type: 'boolean',
    nullable: true,
    name: 'promotion_active',
    default: false,
  })
  promotionActive: boolean;

  @Column({
    type: 'enum',
    enum: ['percentage', 'fixed'],
    nullable: true,
    name: 'promotion_type',
  })
  promotionType: 'percentage' | 'fixed';

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'promotion_value',
  })
  promotionValue: number;

  @Column({
    type: 'datetime',
    nullable: true,
    name: 'promotion_start_date',
  })
  promotionStartDate: Date;

  @Column({
    type: 'datetime',
    nullable: true,
    name: 'promotion_end_date',
  })
  promotionEndDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Check if the campaign promotion is currently active and valid
   */
  isPromotionValid(): boolean {
    if (!this.promotionActive || !this.promotionType || this.promotionValue === null || this.promotionValue === undefined) {
      return false;
    }

    const now = new Date();

    // Check start date if set
    if (this.promotionStartDate && now < this.promotionStartDate) {
      return false;
    }

    // Check end date if set
    if (this.promotionEndDate && now > this.promotionEndDate) {
      return false;
    }

    return true;
  }

  /**
   * Calculate the discounted price for a given original price
   */
  calculateDiscountedPrice(originalPrice: number): number {
    if (!this.isPromotionValid()) {
      return originalPrice;
    }

    if (this.promotionType === 'percentage') {
      // Percentage discount (e.g., 10% off)
      const discount = (originalPrice * this.promotionValue) / 100;
      return Math.max(0, originalPrice - discount);
    } else if (this.promotionType === 'fixed') {
      // Fixed amount discount (e.g., 10€ off)
      return Math.max(0, originalPrice - this.promotionValue);
    }

    return originalPrice;
  }

  /**
   * Get the discount amount for a given original price
   */
  getDiscountAmount(originalPrice: number): number {
    const discountedPrice = this.calculateDiscountedPrice(originalPrice);
    return originalPrice - discountedPrice;
  }
}
