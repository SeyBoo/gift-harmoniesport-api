import { IsOptional, IsString, IsNumber, IsIn } from 'class-validator';

export class ChatGPTRequestDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsIn(['json', 'text'])
  format?: 'json' | 'text';
}
