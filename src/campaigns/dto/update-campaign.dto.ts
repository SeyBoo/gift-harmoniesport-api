import { PartialType } from '@nestjs/mapped-types';
import { CreateCampaignDto } from './create-campaign.dto';
import { IsNumber, IsOptional, IsArray, IsEnum } from 'class-validator';
import { TagOption } from '../entities/campaign.entity';

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {
  @IsOptional()
  @IsNumber()
  thematicId?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(TagOption, { each: true })
  tags?: TagOption[];

  celebrityIds?: number[];
}
