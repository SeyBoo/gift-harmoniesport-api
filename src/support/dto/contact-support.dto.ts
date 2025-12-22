import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ContactSupportDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;

  @IsString()
  @MaxLength(100)
  name?: string;

  @IsString()
  @MaxLength(200)
  subject?: string;
}
