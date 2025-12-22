import { IsNumber, IsPositive, IsString, IsOptional, IsEnum, Min, Max, ValidateIf, IsBoolean, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { IsPromotionEndDateValid } from '../validators/promotion-dates.validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsPositive()
  @IsNumber()
  price: number;

  @IsPositive()
  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsEnum(['percentage', 'fixed'])
  commissionType?: 'percentage' | 'fixed';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => o.commissionType === 'percentage')
  @Max(100, { message: 'Commission percentage cannot exceed 100%' })
  commissionValue?: number;

  @IsOptional()
  @IsBoolean()
  promotionActive?: boolean;

  @IsOptional()
  @IsEnum(['percentage', 'fixed'])
  promotionType?: 'percentage' | 'fixed';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => o.promotionType === 'percentage')
  @Max(100, { message: 'Promotion percentage cannot exceed 100%' })
  promotionValue?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  promotionStartDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @IsPromotionEndDateValid()
  promotionEndDate?: Date;
}
