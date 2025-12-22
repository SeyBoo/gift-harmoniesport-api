import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MessageProvider } from '../dto/send-message.dto';

export enum EmailStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('emails')
export class Email {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', nullable: true })
  htmlBody: string;

  @Column({
    type: 'enum',
    enum: EmailStatus,
    default: EmailStatus.DRAFT,
  })
  status: EmailStatus;

  @Column({
    type: 'enum',
    enum: MessageProvider,
    default: MessageProvider.EMAIL,
  })
  provider: MessageProvider;

  @Column({ type: 'json' })
  recipients: Array<{
    email?: string;
    phone?: string;
    name?: string;
  }>;

  @Column({ type: 'int', default: 0 })
  recipientCount: number;

  @Column({ type: 'datetime', nullable: true })
  sentAt: Date;

  @Column({ type: 'json', nullable: true })
  sendResult: {
    success: boolean;
    sentCount: number;
    failedCount: number;
    errors?: Array<{
      recipient: { email: string; name?: string };
      error: string;
    }>;
  };

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}