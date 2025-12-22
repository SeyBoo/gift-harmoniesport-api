import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { UploadSession } from './upload-session.entity';
import { Bundle } from '../../../products/types/products.interface';
export enum UploadItemStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PROCESSING = 'processing',
  UPLOADED = 'uploaded',
}

@Entity('upload_item')
export class UploadItem {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @JoinColumn({ name: 'upload_session_id' })
  @ManyToOne(
    () => UploadSession,
    (uploadSession) => uploadSession.uploadItems,
    { onDelete: 'CASCADE' },
  )
  uploadSession: UploadSession;

  @Column({ type: 'varchar', length: 255, name: 'product_name' })
  productName: string;

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

  @Column({
    type: 'json',
    nullable: true,
    name: 'price',
  })
  price: Bundle;

  @Column({
    type: 'enum',
    enum: UploadItemStatus,
    default: UploadItemStatus.PENDING,
  })
  status: UploadItemStatus;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'int', default: 1, name: 'quantity' })
  quantity: number;

  @Column({ type: 'json', nullable: true, name: 'metadata' })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
