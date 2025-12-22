import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { UploadStatus } from '../upload/entities/upload-session.entity';

export class CreateSessionDto {
  @IsPositive()
  @IsOptional()
  totalFiles: number;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsPositive()
  totalFiles?: number;

  @IsOptional()
  @IsNumber()
  progressPercentage?: number;

  @IsOptional()
  @IsEnum(UploadStatus)
  status?: UploadStatus;
}

export class PresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;

  @IsString()
  @IsNotEmpty()
  folder: string;
}
