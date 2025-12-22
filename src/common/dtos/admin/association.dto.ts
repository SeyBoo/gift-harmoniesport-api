import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { PaginationDto } from '../pagination.dto';

export enum AssociationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ALL = 'all',
}

export class ListAssociationsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  thematicId?: string;

  @IsOptional()
  @IsEnum(AssociationStatus)
  status?: AssociationStatus = AssociationStatus.ALL;
}

export class ToggleStatusDto {
  @IsBoolean()
  isActive: boolean;
}

export enum DashboardPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUAL = 'semiAnnual',
  ANNUAL = 'annual',
  ALL_TIME = 'allTime',
}

export class GetDashboardMetricsDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsEnum(DashboardPeriod)
  period: DashboardPeriod = DashboardPeriod.MONTHLY;
}
