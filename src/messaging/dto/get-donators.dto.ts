import { IsOptional, IsArray, IsEnum } from 'class-validator';

export enum PurchaseType {
  MAGNET = 'magnet',
  DIGITAL = 'digital',
  COLLECTOR = 'collector',
}

export class GetDonatorsDto {
  @IsOptional()
  @IsArray()
  @IsEnum(PurchaseType, { each: true })
  purchaseTypes?: PurchaseType[];

  // associationId is now extracted from JWT token, not query parameter
  associationId?: number;
}
