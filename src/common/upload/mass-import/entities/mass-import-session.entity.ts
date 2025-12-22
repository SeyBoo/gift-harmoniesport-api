import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { MassImportItem } from './mass-import-item.entity';
import { User } from '../../../../users/entities/user.entity';

export enum MassImportStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PROCESSING = 'processing',
  UPLOADED = 'uploaded',
}

@Entity('mass_import_session')
export class MassImportSession {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'enum', enum: MassImportStatus, default: MassImportStatus.PENDING })
  status: MassImportStatus;

  @Column({ type: 'int', default: 0, name: 'total_items' })
  totalItems: number;

  @Column({ type: 'int', default: 0, name: 'processed_items' })
  processedItems: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    name: 'progress_percentage',
  })
  progressPercentage: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'session_name' })
  sessionName: string;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description: string;

  @Column({ type: 'json', nullable: true, name: 'metadata' })
  metadata: Record<string, any>;

  @OneToMany(() => MassImportItem, (massImportItem) => massImportItem.massImportSession, {
    cascade: true,
  })
  massImportItems: MassImportItem[];

  @ManyToOne(() => User, (user) => user.massImportSessions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
