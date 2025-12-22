import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsOptional()
  @IsNumber()
  orderId?: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fees?: number;

  @IsNumber()
  @Min(0)
  netAmount: number;

  @IsNumber()
  associationId: number;

  @IsOptional()
  @IsBoolean()
  isPayout?: boolean = false;

  @IsOptional()
  @IsString()
  status?: string = 'completed';
} 