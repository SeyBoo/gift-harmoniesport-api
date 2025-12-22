import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { VARIANT_GENERATOR_IMAGE } from '../../genimage/genimage.constant';
import { GenerateImageType } from '../../users/entities/user-ai-generation.entity';

export class GenerateAiCardDto {
  @IsString()
  prompt: string;

  @IsEnum(GenerateImageType)
  imageType: GenerateImageType;
}

export class GenerateDynamicCardDto {
  @IsEnum(VARIANT_GENERATOR_IMAGE)
  variant: VARIANT_GENERATOR_IMAGE;

  @IsOptional()
  @IsString()
  playerFirstname: string;

  @IsOptional()
  @IsString()
  campaignId: string;

  @IsOptional()
  @IsString()
  playerLastname: string;

  @ValidateIf((o) => o.variant === VARIANT_GENERATOR_IMAGE.CARD003)
  @IsString()
  playerNumber: string;

  @IsString()
  playerFaceUrl: string;

  @IsString()
  @IsOptional()
  seasonLabel: string;

  @IsOptional()
  @IsString()
  format: 'png' | 'pdf' = 'png';

  @IsOptional()
  @IsBoolean()
  removeBackground: boolean = true;

  @IsOptional()
  @IsNumber()
  playerZoomFactor: number = 1;
}

export class CreateBulkProductDto {
  @IsUUID()
  uploadSessionId: string;

  @IsNumber()
  campaignId: number;
}
