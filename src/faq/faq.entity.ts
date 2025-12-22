import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Faq {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'json', nullable: false })
  question: Record<string, string>;

  @Column({ type: 'json', nullable: false })
  answer: Record<string, string>;

  @Column({ type: 'json', nullable: true })
  category: Record<string, string>;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'created_at',
  })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
    name: 'updated_at',
  })
  updatedAt: Date;
}
