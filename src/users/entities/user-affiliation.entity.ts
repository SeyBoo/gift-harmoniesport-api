import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
  Unique,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { UserTransaction } from './user-transaction.entity';

export const DEFAULT_EARNING_PERCENTAGE_DONOR = 2; // 2% for donors
export const DEFAULT_EARNING_PERCENTAGE_ASSOCIATION = 2.5; // 2.5% for associations
export const EXPIRATION_AFFILIATION_TIME_MS = 365 * 24 * 60 * 60 * 1000; // 1 year (only for donors)

@Entity()
@Check(`"affiliate_user_id" != "affiliated_user_id"`)
@Unique(['affiliateUserId', 'affiliatedUserId'])
export class UserAffiliation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'float',
    name: 'earning_percentage',
    default: DEFAULT_EARNING_PERCENTAGE_DONOR,
  })
  earningPercentage: number;

  @Column({ nullable: false, name: 'affiliate_user_id' })
  affiliateUserId: number;

  // an user can be affiliated only one time !
  @Column({ nullable: false, name: 'affiliated_user_id', unique: true })
  affiliatedUserId: number;

  @ManyToOne(() => User, (user) => user.affiliations)
  @JoinColumn({ name: 'affiliate_user_id' })
  affiliateUser: User;

  @OneToOne(() => User, (user) => user.affiliatedBy)
  @JoinColumn({ name: 'affiliated_user_id' })
  affiliatedUser: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'expired_at', nullable: true })
  expiredAt: Date | null;

  @OneToMany(
    () => UserTransaction,
    (userTransaction) => userTransaction.userAffiliation,
  )
  userTransactions: UserTransaction[];

  // Note: expiredAt is now set in the service based on user type:
  // - For donors: 1 year from creation
  // - For associations: null (permanent)
}
