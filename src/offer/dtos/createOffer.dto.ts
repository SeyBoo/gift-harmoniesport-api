import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreateOfferDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  productId: number;
}
