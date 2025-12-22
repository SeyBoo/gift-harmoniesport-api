import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  JoinColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { UserProduct } from './userproduct.entity';
import { UserAiGeneration } from '../../users/entities/user-ai-generation.entity';
import { Celebrity } from '../../celebrities/entities/celebrity.entity';
import { Bundle } from '../types/products.interface';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'json',
    nullable: true,
    name: 'price',
  })
  price: Bundle;

  @Column({ default: 'EUR' })
  currency: string;

  @Column()
  image: string;

  @Column({
    name: 'image_url',
    nullable: true,
    default: null,
    type: 'varchar',
    length: '255',
  })
  imageUrl: string;

  @Column({
    name: 'slug',
    nullable: true,
    default: null,
    type: 'varchar',
    length: '255',
  })
  slug: string;

  @Column({ nullable: true })
  video_promo: string;

  @ManyToOne(() => Celebrity, { nullable: true })
  @JoinColumn({ name: 'celebrity_id' })
  celebrity?: Celebrity;

  @Column({ nullable: true })
  video_thanks: string;

  @Column({ nullable: true, name: 'thanks_video_ia_id' })
  thanksVideoIaId: string;

  @Column({ type: 'longtext' })
  message_donation: string;

  @Column({
    type: 'json',
    nullable: true,
    name: 'multilingual_message_donation',
  })
  multilingualMessageDonation: Record<string, string>;

  @Column({ type: 'longtext' })
  message_celebrity: string;

  @Column({
    type: 'json',
    nullable: true,
    name: 'multilingual_message_celebrity',
  })
  multilingualMessageCelebrity: Record<string, string>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ nullable: true, name: 'user_ai_generation_id' })
  userAiGenerationId: number;

  @ManyToOne(() => UserAiGeneration, (userAiGeneration) => userAiGeneration.id)
  @JoinColumn({ name: 'user_ai_generation_id' })
  userAiGeneration: UserAiGeneration;

  @ManyToOne(() => Campaign, (campaign) => campaign.id)
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ nullable: true, name: 'handle_distribution' })
  handleDistribution: boolean;

  @Column({ nullable: true, name: 'player_face_url' })
  playerFaceUrl?: string;

  @Column({ nullable: true, name: 'print_url' })
  printUrl?: string;

  @Column({ nullable: true, name: 'collector_print_url' })
  collectorPrintUrl?: string;

  @Column({ nullable: true, name: 'collector_image_url' })
  collectorImageUrl?: string;

  @Column({ nullable: true, name: 'digital_image_url' })
  digitalImageUrl?: string;

  @Column({ nullable: true, name: 'magnet_image_url' })
  magnetImageUrl?: string;

  @Column({
    type: 'enum',
    enum: ['percentage', 'fixed'],
    nullable: true,
    name: 'commission_type',
    default: 'fixed',
  })
  commissionType: 'percentage' | 'fixed';

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'commission_value',
  })
  commissionValue: number;

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

  @OneToMany(() => UserProduct, (userProduct) => userProduct.product)
  userProducts: UserProduct[];

  /**
   * Check if the product promotion is currently active and valid
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
   * Priority: Product promotion > Campaign promotion
   */
  calculateDiscountedPrice(originalPrice: number): number {
    // First, check product-level promotion
    if (this.isPromotionValid()) {
      if (this.promotionType === 'percentage') {
        const discount = (originalPrice * this.promotionValue) / 100;
        return Math.max(0, originalPrice - discount);
      } else if (this.promotionType === 'fixed') {
        return Math.max(0, originalPrice - this.promotionValue);
      }
    }

    // If no product promotion, check campaign-level promotion
    if (this.campaign && this.campaign.isPromotionValid()) {
      if (this.campaign.promotionType === 'percentage') {
        const discount = (originalPrice * this.campaign.promotionValue) / 100;
        return Math.max(0, originalPrice - discount);
      } else if (this.campaign.promotionType === 'fixed') {
        return Math.max(0, originalPrice - this.campaign.promotionValue);
      }
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

  /**
   * Check if any promotion is active (product or campaign level)
   */
  hasActivePromotion(): boolean {
    return this.isPromotionValid() || (this.campaign && this.campaign.isPromotionValid());
  }

  /**
   * Get the active promotion source (product or campaign)
   */
  getPromotionSource(): 'product' | 'campaign' | null {
    if (this.isPromotionValid()) {
      return 'product';
    }
    if (this.campaign && this.campaign.isPromotionValid()) {
      return 'campaign';
    }
    return null;
  }
}
