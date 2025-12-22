import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { AccessLevel, AdminRole } from '../../../admin/entities/admin.entity';
import { PaginationDto } from '../pagination.dto';

export class CreateAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(AdminRole)
  role: AdminRole;

  @IsEnum(AccessLevel)
  accessLevel: AccessLevel;

  @IsBoolean()
  @IsOptional()
  requireTwoFactor?: boolean;
}

export class ListAdminsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isTwoFactorEnabled?: string;
}
