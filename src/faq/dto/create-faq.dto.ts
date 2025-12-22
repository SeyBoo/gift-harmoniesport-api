import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { SupportedLanguage } from '../../common/translator/translator.constant';

export class CreateFaqDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsNotEmpty()
  answer: string;

  @IsOptional()
  @IsString()
  sourceLanguage?: SupportedLanguage = 'fr';

  @IsOptional()
  @IsString()
  category?: string;
}
