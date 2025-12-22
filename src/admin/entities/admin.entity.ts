import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  Unique,
} from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';

export enum AdminRole {
  SUPER_ADMIN = 'SuperAdmin',
  AFFILIATE = 'Affiliate',
}

export enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
  BOTH = 'both',
}

@Entity()
@Unique(['email', 'role']) // Should be unique
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'profile_image',
  })
  profileImage: string;

  @Column({ type: 'enum', enum: AdminRole })
  role: AdminRole;

  @Column({
    type: 'enum',
    enum: AccessLevel,
    default: AccessLevel.BOTH,
    name: 'access_level',
  })
  accessLevel: AccessLevel;

  @Column('simple-array', { nullable: true, name: 'feature_list' })
  featureList: string[];

  @Column({ type: 'boolean', default: false, name: 'is_two_factor_enabled' })
  isTwoFactorEnabled: boolean;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'two_factor_secret',
  })
  twoFactorSecret: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async verifyPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  verifyAuthenticatorCode(code: string): boolean {
    if (!this.twoFactorSecret) {
      return false;
    }
    return authenticator.verify({
      token: code,
      secret: this.twoFactorSecret,
    });
  }
}
