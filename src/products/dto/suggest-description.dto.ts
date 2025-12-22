import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class SuggestCardDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2, {
    message: 'Association name must be at least 2 characters long',
  })
  @MaxLength(100, {
    message: 'Association name must not exceed 100 characters',
  })
  association: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Campaign name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Campaign name must not exceed 100 characters' })
  campaign: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Card name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Card name must not exceed 100 characters' })
  card: string;
}
