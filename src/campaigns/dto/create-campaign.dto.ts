import { Campaign } from '../entities/campaign.entity';
import { Celebrity } from '../../celebrities/entities/celebrity.entity';
import { User } from '../../users/entities/user.entity';
import { TagOption } from '../entities/campaign.entity';
import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCampaignDto {
  campagne_name: string;
  description?: string;
  video?: string;
  date_start?: string;
  date_end?: string;
  tags?: TagOption[];
  campaign?: Campaign;
  celebrities?: Celebrity[];
  handle_distribution?: boolean;
  celebrityId?: number;
  user?: User;

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
  promotionEndDate?: Date;
}
