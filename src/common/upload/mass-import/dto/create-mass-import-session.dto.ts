import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class ImagePositionDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class TextPositionDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class AiCheckDto {
  @IsString()
  status: 'pending' | 'checking' | 'passed' | 'warning' | 'failed';

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsNumber()
  score?: number;
}

export class PlayerCardItemDto {
  @IsNumber()
  index: number;

  @IsString()
  id: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  playerNumber: string;

  @IsOptional()
  @IsString()
  playerFace?: string;

  @IsString()
  season: string;

  @IsString()
  variant: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ValidateNested()
  @Type(() => ImagePositionDto)
  imagePosition: ImagePositionDto;

  @IsNumber()
  imageScale: number;

  @IsNumber()
  imageRotation: number;

  @IsNumber()
  cardDesign: number;

  @ValidateNested()
  @Type(() => TextPositionDto)
  textPosition: TextPositionDto;

  @IsNumber()
  firstNameSize: number;

  @IsNumber()
  lastNameSize: number;

  @IsNumber()
  textGap: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiCheckDto)
  aiCheck?: AiCheckDto;

  @IsString()
  status: 'pending' | 'ready' | 'completed' | 'error';

  @IsBoolean()
  reviewed: boolean;
}

export class CreateMassImportSessionDto {
  @IsOptional()
  @IsString()
  sessionName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerCardItemDto)
  items: PlayerCardItemDto[];
}
