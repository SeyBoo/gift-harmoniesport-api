import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Thematic } from '../../thematics/entities/thematic.entity';
import { IsEnum, IsNumber, IsOptional, Max, Min, ValidateIf, IsBoolean, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { IsPromotionEndDateValid } from '../validators/promotion-dates.validator';

export class CreateCardDto {
  name: string;
  message_donation: string;
  price: string;
  message_celebrity: string;
  image: string;
  generateImageId: number;
  video_promo?: string;
  video_thanks?: string;
  quantity: number;
  campaign: Campaign;
  thematic: Thematic;
  slug?: string;
  imageUrl?: string;
  thanksVideoIaId?: string;
  celebrityId?: number;
  handleDistribution?: string;
  playerFaceUrl?: string;

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

export class GenerateCardDto {
  prompt: string;
}
