import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Celebrity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  jobTitle?: Record<string, string>;

  @Column({ type: 'text', nullable: true })
  imageUrl?: string;

  @Column({ type: 'text', nullable: true })
  backgroundUrl?: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  description?: Record<string, string>;

  @Column({ type: 'text', nullable: true })
  instagramUrl?: string;

  @Column('simple-array')
  associations: number[];

  @Column({ type: 'boolean', default: false, name: 'is_confirmed' })
  isConfirmed: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_deleted' })
  isDeleted: boolean;
}
