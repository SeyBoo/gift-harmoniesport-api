import { IsArray, IsNotEmpty, ValidateNested, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductForRedesignDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  team?: string;

  @IsString()
  @IsOptional()
  year?: string;

  @IsString()
  @IsOptional()
  playerFaceUrl?: string;

  @IsNumber()
  @IsOptional()
  cardDesign?: number;
}

export class SendForRedesignDto {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProductForRedesignDto)
  products: ProductForRedesignDto[];
}
