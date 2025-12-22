import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { MassImportSession } from './mass-import-session.entity';

export enum MassImportItemStatus {
  PENDING = 'pending',
  READY = 'ready',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export enum AiCheckStatus {
  PENDING = 'pending',
  CHECKING = 'checking',
  PASSED = 'passed',
  WARNING = 'warning',
  FAILED = 'failed',
}

@Entity('mass_import_item')
export class MassImportItem {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'mass_import_session_id' })
  massImportSessionId: string;

  @Column({ type: 'int', name: 'index' })
  index: number;

  @Column({ type: 'varchar', length: 255, name: 'first_name' })
  firstName: string;

  @Column({ type: 'varchar', length: 255, name: 'last_name' })
  lastName: string;

  @Column({ type: 'varchar', length: 10, name: 'player_number' })
  playerNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'player_face' })
  playerFace?: string;

  @Column({ type: 'varchar', length: 100, name: 'season' })
  season: string;

  @Column({ type: 'varchar', name: 'variant' })
  variant: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'image_url' })
  imageUrl: string;

  @Column({ type: 'json', name: 'image_position' })
  imagePosition: { x: number; y: number };

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'image_scale' })
  imageScale: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'image_rotation' })
  imageRotation: number;

  @Column({ type: 'int', name: 'card_design' })
  cardDesign: number;

  @Column({ type: 'json', name: 'text_position' })
  textPosition: { x: number; y: number };

  @Column({ type: 'int', name: 'first_name_size' })
  firstNameSize: number;

  @Column({ type: 'int', name: 'last_name_size' })
  lastNameSize: number;

  @Column({ type: 'int', name: 'text_gap' })
  textGap: number;

  @Column({ type: 'json', nullable: true, name: 'ai_check' })
  aiCheck?: {
    status: AiCheckStatus;
    message?: string;
    score?: number;
  };

  @Column({ 
    type: 'enum', 
    enum: MassImportItemStatus, 
    default: MassImportItemStatus.PENDING,
    name: 'status'
  })
  status: MassImportItemStatus;

  @Column({ type: 'boolean', default: false, name: 'reviewed' })
  reviewed: boolean;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({ type: 'json', nullable: true, name: 'metadata' })
  metadata: Record<string, any>;

  @ManyToOne(() => MassImportSession, (massImportSession) => massImportSession.massImportItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'mass_import_session_id' })
  massImportSession: MassImportSession;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
