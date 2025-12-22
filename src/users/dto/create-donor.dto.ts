import { UserType } from '../entities/user-type.entity';
import { Thematic } from '../../thematics/entities/thematic.entity';

export class CreateDonorDto {
  name: string;
  lastname: string;
  address: string;
  email: string;
  password: string;
  thematic: Thematic;
  userType: UserType;
  affiliateUserCode?: string;
  termsAcceptedAt?: Date;
}
