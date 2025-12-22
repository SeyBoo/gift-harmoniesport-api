import { IsString, IsOptional, IsArray, IsEnum, IsNumber } from 'class-validator';
import { MessageRecipient } from '../interfaces/message-connector.interface';
import { MessageProvider } from './send-message.dto';

export class SaveDraftDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsEnum(MessageProvider)
  provider?: MessageProvider;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  htmlBody?: string;

  @IsOptional()
  @IsArray()
  recipients?: MessageRecipient[];
}
