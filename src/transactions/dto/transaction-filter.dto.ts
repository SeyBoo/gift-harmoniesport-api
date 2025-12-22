import { IsDateString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dtos/pagination.dto';

export class TransactionFilterDto extends PaginationDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  associationId?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
} 