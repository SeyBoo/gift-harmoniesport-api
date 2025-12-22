import {
  IsEmail,
  IsString,
  MinLength,
  IsBoolean,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}

export class AdminRefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class TwoFactorDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

export class Enable2FADto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}
