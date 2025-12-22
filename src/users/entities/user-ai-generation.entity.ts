import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum GenerateImageType {
  Realistic = 'realistic',
  PseudoRealistic = 'pseudo-realistic',
  Cartoon = 'cartoon',
}
@Entity()
export class UserAiGeneration {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ nullable: true, type: 'int' })
  progress: number;

  @Column({ type: 'varchar', length: 255, name: 'image_name', nullable: true })
  imageName: string;

  @Column({ type: 'varchar', length: 255, name: 'image_type' })
  imageType: GenerateImageType;

  @Column({ type: 'varchar', length: 255, name: 'image_url', nullable: true })
  imageUrl: string;

  @Column({
    name: 'generated_image_urls',
    nullable: true,
    type: 'text',
  })
  generatedImageUrls: string;

  @Column({ nullable: true })
  status: 'pending' | 'in-progress' | 'completed' | 'failed';

  @Column({ nullable: true, name: 'webhook_id' })
  webhookId: string;

  @Column({ nullable: false, name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.userProducts)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
