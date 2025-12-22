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
import { UploadItem } from './upload-item.entity';
import { User } from '../../../users/entities/user.entity';

export enum UploadStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PROCESSING = 'processing',
  UPLOADED = 'uploaded',
}

@Entity('upload_session')
export class UploadSession {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'enum', enum: UploadStatus, default: UploadStatus.PENDING })
  status: UploadStatus;

  @Column({ type: 'int', default: 0, name: 'total_files' })
  totalFiles: number;

  @Column({ type: 'int', default: 0, name: 'processed_files' })
  processedFiles: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    name: 'progress_percentage',
  })
  progressPercentage: number;

  @OneToMany(() => UploadItem, (uploadItem) => uploadItem.uploadSession, {
    cascade: true,
  })
  uploadItems: UploadItem[];

  @ManyToOne(() => User, (user) => user.uploadSessions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
