import { IsOptional, IsEnum, Min, IsNumber, Max, IsInt } from 'class-validator';
import { UserTypeEnum } from '../../../users/entities/user-type.entity';
import { PaginationDto } from '..';

export class ListAffiliationsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(['active', 'expired'])
  status?: 'active' | 'expired';

  @IsOptional()
  @IsEnum(UserTypeEnum)
  userType?: UserTypeEnum;
}

export class UpdateEarningDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  earningPercentage: number;
}

export class CreateAffiliationDto {
  @IsInt()
  affiliateUserId: number; // The referrer (who will earn commission)

  @IsInt()
  affiliatedUserId: number; // The association/donor being referred

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  earningPercentage?: number; // Optional, defaults based on user type (2.5% for associations, 2% for donors)
}
