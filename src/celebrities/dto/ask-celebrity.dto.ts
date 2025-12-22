import { IsString } from 'class-validator';

export class AskCelebrityDto {
  @IsString()
  instagramUrl: string;

  @IsString()
  name: string;
}