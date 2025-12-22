import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdatePassUserDto extends PartialType(CreateUserDto) {
  password: string;
  token_pass: string;
  token_pass_date_start: Date;
}
