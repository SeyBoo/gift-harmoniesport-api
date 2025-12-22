import { IsString, IsUrl, IsArray, IsNumber } from 'class-validator';

export class CreateCelebrityDto {
  @IsString()
  name: string;

  @IsString()
  jobTitle: string;

  @IsUrl()
  imageUrl: string;

  @IsUrl()
  backgroundUrl: string;

  @IsString()
  description: string;

  @IsString()
  instagramUrl: string;

  @IsArray()
  @IsNumber({}, { each: true })
  cards: number[];

  @IsArray()
  @IsNumber({}, { each: true })
  associations: number[];
}
