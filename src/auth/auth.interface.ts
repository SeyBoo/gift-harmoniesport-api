import { UserType } from '../users/entities/user-type.entity';
import { SubThematic } from '../thematics/entities/sub_thematic.entity';
import { Thematic } from '../thematics/entities/thematic.entity';
export interface AuthUser {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface GoogleUser {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  accessToken: string;
}

export interface User {
  name: string;
  lastName: string;
  address: string;
  email: string;
  userType: UserType;
  id: number;
  association?: {
    name_association: string;
    logo: string;
    thematic?: Thematic;
    subThematic?: SubThematic;
    accountSetup?: boolean;
    rib?: string;
    kycUrl?: string;
    kybUrl?: string;
    description?: string;
    site_internet?: string;
    facebookLink?: string;
    instagramLink?: string;
    twitterLink?: string;
    tiktokLink?: string;
    linkedinLink?: string;
    fond_usage_description?: Record<string, string>;
    mission_description?: Record<string, string>;
    shorten_description?: Record<string, string>;
    multilingualDescription?: Record<string, string>;
    
  };
}
