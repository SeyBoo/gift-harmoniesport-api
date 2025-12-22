import { Thematic } from '../../thematics/entities/thematic.entity';
import { UserType } from '../entities/user-type.entity';

export class CreateUserDto {
  name: string;
  lastname: string;
  contact_name: string;
  address: string;
  facebookLink: string;
  instagramLink: string;
  twitterLink: string;
  tiktokLink: string;
  linkedinLink: string;
  email: string;
  password: string;
  site_internet: string;
  description: string;
  reference: string;
  rib: string;
  name_association: string;
  logo: string;
  logo_name: string;
  activation_key: string;
  user_status: boolean;
  color_asso: string;
  thematic: Thematic;
  userType: UserType;
  stripeCustomerId?: string;
  affiliateUserCode?: string;
  termsAcceptedAt?: Date;
  kycUrl?: string;
  kybUrl?: string;
}
