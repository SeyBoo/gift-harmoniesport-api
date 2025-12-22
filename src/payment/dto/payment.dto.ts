import { IsOptional, IsString } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString()
  bundle: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  video?: string;
}

export class ConfirmPaymentDto {
  @IsString()
  paymentIntentId: string;

  @IsString()
  @IsOptional()
  paymentMethodId: string;
}
