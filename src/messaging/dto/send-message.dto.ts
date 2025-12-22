import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { MessageRecipient } from '../interfaces/message-connector.interface';

export enum MessageProvider {
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
}

export class SendMessageDto {
  @IsEnum(MessageProvider)
  provider: MessageProvider;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  htmlBody?: string;

  @IsArray()
  recipients: MessageRecipient[];
}
