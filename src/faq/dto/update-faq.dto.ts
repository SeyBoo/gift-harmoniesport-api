import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { SupportedLanguage } from '../../common/translator/translator.constant';

export class UpdateFaqDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  question?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  answer?: string;

  @IsOptional()
  @IsString()
  sourceLanguage?: SupportedLanguage = 'fr';

  @IsOptional()
  @IsString()
  category?: string;
}
