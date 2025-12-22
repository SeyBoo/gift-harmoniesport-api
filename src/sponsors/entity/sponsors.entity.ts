import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity()
export class Sponsor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  logo: string;

  @Column()
  link: string;

  @Column({ nullable: true })
  height: number;

  @Column({ nullable: true })
  width: number;

  @ManyToOne(() => User, (user) => user.sponsors)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
