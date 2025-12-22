import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Thematic } from './thematic.entity';

@Entity()
export class SubThematic {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Thematic, (thematic) => thematic.id)
  @JoinColumn({ name: 'thematic_id' })
  thematic: Thematic;

  @Column()
  name: string;

  @Column({ type: 'json', nullable: true, name: 'multilingual_name' })
  multilingualName: Record<string, string>;

  @Column()
  label: string;

  constructor(thematic: Partial<SubThematic>) {
    Object.assign(this, thematic);
  }
}
