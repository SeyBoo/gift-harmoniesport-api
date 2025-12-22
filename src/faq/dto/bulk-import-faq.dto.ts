import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { SupportedLanguage } from '../../common/translator/translator.constant';

export class BulkImportFaqDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsOptional()
  @IsString()
  sourceLanguage?: SupportedLanguage = 'fr';
}
