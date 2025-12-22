import { IsString, MinLength } from 'class-validator';

export class WithdrawalDto {
  amount: string;
  rib: string;
}

export class ChangeUserPasswordDto {
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}
