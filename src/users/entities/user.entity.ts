import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  BeforeInsert,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Thematic } from '../../thematics/entities/thematic.entity';
import { UserType, UserTypeEnum } from './user-type.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { UserProduct } from '../../products/entities/userproduct.entity';
import { Order } from '../../payment/entities/order.entity';
import { UserAffiliation } from './user-affiliation.entity';
import { SubThematic } from '../../thematics/entities/sub_thematic.entity';
import { UploadSession } from '../../common/upload/entities/upload-session.entity';
import { Sponsor } from '../../sponsors/entity/sponsors.entity';
import { MassImportSession } from '../../common/upload/mass-import/entities/mass-import-session.entity';
export const UserTypeIdByName = {
  [UserTypeEnum.ASSOCIATION]: 1,
  [UserTypeEnum.DONATEUR]: 2,
} as const;

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  lastname: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true, name: 'facebook_link' })
  facebookLink: string;

  @Column({ nullable: true, name: 'instagram_link' })
  instagramLink: string;

  @Column({ nullable: true, name: 'twitter_link' })
  twitterLink: string;

  @Column({ nullable: true, name: 'tiktok_link' })
  tiktokLink: string;

  @Column({ nullable: true, name: 'linkedin_link' })
  linkedinLink: string;

  @Column({ nullable: true, type: 'float' })
  latitude: number;

  @Column({ nullable: true, type: 'float' })
  longitude: number;

  @Column({ nullable: true })
  contact_name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  site_internet: string;

  @Column({ nullable: true, length: 2500 })
  description: string;

  @Column({
    type: 'json',
    nullable: true,
    name: 'multilingual_description',
  })
  multilingualDescription: Record<string, string>;

  @Column({ nullable: true })
  reference: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'kyc_url',
    default: null,
  })
  kycUrl: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'kyb_url',
    default: null,
  })
  kybUrl: string;

  @Column({ nullable: true })
  rib: string;

  @Column({ nullable: true })
  name_association: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  activation_key: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'affiliation_code',
    default: null,
  })
  affiliationCode: string;

  @Column({ nullable: true })
  color_asso: string;

  @Column({ nullable: true, type: 'json' })
  mission_description: { [key: string]: string };

  @Column({ nullable: true, type: 'json' })
  shorten_description: { [key: string]: string };

  @Column({ nullable: true, type: 'json' })
  fond_usage_description: { [key: string]: string };

  @Column({ nullable: true })
  token_pass: string;

  @Column({ nullable: true })
  token_pass_date_start: Date;

  @Column({ nullable: true })
  user_status: boolean;

  @Column({
    type: 'varchar',
    length: '255',
    nullable: true,
    name: 'stripe_customer_id',
  })
  stripeCustomerId: string;

  @Column({
    type: 'varchar',
    length: '255',
    nullable: true,
    name: 'stripe_account_id',
  })
  stripeAccountId: string;

  @Column({
    type: 'boolean',
    default: false,
    name: 'account_setup',
  })
  accountSetup: boolean;

  @Column({
    name: 'slug',
    nullable: true,
    default: null,
    type: 'varchar',
    length: '255',
  })
  slug: string;

  @ManyToOne(() => Thematic, (thematic) => thematic.id)
  @JoinColumn({ name: 'thematic_id' })
  thematic: Thematic;

  @ManyToOne(() => SubThematic, (subThematic) => subThematic.id)
  @JoinColumn({ name: 'sub_thematic_id' })
  subThematic?: SubThematic;

  @ManyToOne(() => UserType, (userType) => userType.id)
  @JoinColumn({ name: 'user_type_id' })
  userType: UserType;

  @OneToMany(() => Campaign, (campaign) => campaign.user)
  campaigns: Campaign[];

  @OneToMany(() => Sponsor, (sponsor) => sponsor.user)
  sponsors: Sponsor[];

  @OneToOne(() => Wallet, (wallet) => wallet.id)
  wallet: Wallet;

  @OneToMany(() => UserProduct, (userProduct) => userProduct.user)
  userProducts: UserProduct[];

  @OneToMany(() => UploadSession, (uploadSession) => uploadSession.user)
  uploadSessions: UploadSession[];

  @OneToMany(() => MassImportSession, (massImportSession) => massImportSession.user)
  massImportSessions: MassImportSession[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => UserAffiliation, (affiliation) => affiliation.affiliateUser)
  affiliations: UserAffiliation[];

  @OneToOne(() => UserAffiliation, (affiliation) => affiliation.affiliatedUser)
  affiliatedBy: UserAffiliation;

  @Column({ type: 'datetime', nullable: true, name: 'terms_accepted_at' })
  termsAcceptedAt: Date;

  @Column({ type: 'boolean', default: false, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  constructor(user: Partial<User>) {
    Object.assign(this, user);
  }
  @BeforeInsert()
  generateAffiliationCode() {
    const generateRandomString = (length: number) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
      }
      return result;
    };

    const prefix = 'GIFT-';
    const uniquePart = generateRandomString(6);
    const timestamp = Date.now().toString().slice(-4);

    this.affiliationCode = `${prefix}${uniquePart}-${timestamp}`;
  }
}
