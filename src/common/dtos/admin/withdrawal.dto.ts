import {
  IsEnum,
  IsOptional,
  IsInt,
  ValidateIf,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WithdrawalStatus } from '../../../users/entities/user-withdrawal.entity';
import { PaginationDto } from '..';

export class ListWithdrawalsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(WithdrawalStatus)
  status?: WithdrawalStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;
}

export class ProcessWithdrawalDto {
  @IsEnum(WithdrawalStatus)
  status: WithdrawalStatus.ACCEPTED | WithdrawalStatus.REJECTED;

  @ValidateIf((o) => o.status === WithdrawalStatus.REJECTED)
  @IsString()
  rejectReason: string;

  @ValidateIf((o) => o.status === WithdrawalStatus.ACCEPTED)
  @IsString()
  receiptId: string;
}
