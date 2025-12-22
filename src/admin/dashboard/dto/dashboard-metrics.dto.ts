import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum TimeRange {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  ALL = 'all'
}

export class DashboardMetricsDto {
  @IsOptional()
  @IsEnum(TimeRange)
  timeRange?: TimeRange = TimeRange.MONTH;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
} 