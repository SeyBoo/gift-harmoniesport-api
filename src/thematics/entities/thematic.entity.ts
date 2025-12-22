import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ThematicList {
  EDUCATION = 'education',
  ANIMALS = 'animaux',
  HEALTH = 'sante',
  WOMEN = 'femme',
  HUMANITARIAN = 'humanitaire',
  CHILDREN = 'enfant',
  ENVIRONMENT = 'environnement',
  SOLIDARITY = 'solidarite',
  MUSIC = 'musique',
  SPORT = 'sport',
  CELEBRITY = 'celebrite',
}

@Entity()
export class Thematic {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'json', nullable: true, name: 'multilingual_name' })
  multilingualName: Record<string, string>;

  @Column()
  label: string;

  @OneToMany(() => User, (user) => user.thematic)
  users: User[];

  constructor(thematic: Partial<Thematic>) {
    Object.assign(this, thematic);
  }
}
