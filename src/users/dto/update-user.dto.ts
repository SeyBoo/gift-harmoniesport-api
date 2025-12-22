import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  facebookLink?: string;
  instagramLink?: string;
  fond_usage_description?: Record<string, string>;
  mission_description?: Record<string, string>;
  shorten_description?: Record<string, string>;
  multilingualDescription?: Record<string, string>;
  fund_usage_description?: string | Record<string, string>;
  latitude?: number;
  longitude?: number;
  slug?: string;
  kyc?: Express.Multer.File;
  kyb?: Express.Multer.File;
}
