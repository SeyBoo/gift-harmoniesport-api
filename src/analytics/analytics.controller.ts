import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('product/:slug')
  async getProductPageViews(
    @Param('slug') slug: string,
    @Query('months') months: number = 6,
  ) {
    return this.analyticsService.getProductPageViews(slug, months);
  }

  @Get('association/:slug')
  async getAssociationPageViews(
    @Param('slug') slug: string,
    @Query('months') months: number = 6,
  ) {
    return this.analyticsService.getAssociationPageViews(slug, months);
  }

  @Get('association-id')
  async getAssociationAnalytics(
    @Query('months') months: number = 1,
    @Request() req,
  ) {
    const associationId = req.user.id;
    return this.analyticsService.getAssociationAnalytics(associationId, months);
  }
}
