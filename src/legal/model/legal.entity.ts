import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Column } from 'typeorm';
import { LegalLanguage, LegalType } from '../legal.types';

@Entity()
export class Legal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: ['fr', 'en'] })
  language: LegalLanguage;

  @Column({ type: 'enum', enum: ['privacy', 'legal', 'terms', 'ethics'] })
  type: LegalType;

  @CreateDateColumn({
    type: 'timestamp',
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
