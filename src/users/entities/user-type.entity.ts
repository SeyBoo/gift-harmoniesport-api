import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from './user.entity';

export enum UserTypeEnum {
  ASSOCIATION = 'association',
  DONATEUR = 'donateur',
}

@Entity()
export class UserType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: UserTypeEnum;

  @OneToMany(() => User, (user) => user.id)
  user: User;

  constructor(userType: Partial<UserType>) {
    Object.assign(this, userType);
  }
}
