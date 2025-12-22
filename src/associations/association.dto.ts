import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class SuggestAssociationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;
}