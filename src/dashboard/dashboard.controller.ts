import { Controller, Get, Request, UseGuards, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilterSales, SortOrder } from './dashboard.interface';

@Controller('dashboard-asso')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('sales')
  @UseGuards(JwtAuthGuard)
  async getSales(@Request() req, @Query('filter') filter: FilterSales) {
    return this.dashboardService.getSales(req.user.id, filter);
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  async getOverview(@Request() req) {
    return this.dashboardService.getOverview(req.user.id);
  }

  @Get('campaigns-by-sales')
  @UseGuards(JwtAuthGuard)
  async getCampaignsBySales(
    @Request() req,
    @Query('filter') filter: FilterSales,
    @Query('sortOrder') sortOrder: SortOrder = SortOrder.MOST_SOLD,
  ) {
    return this.dashboardService.getCampaignsBySales(
      req.user.id,
      filter,
      sortOrder,
    );
  }

  @Get('bundles-by-sales')
  @UseGuards(JwtAuthGuard)
  async getBundlesBySales(
    @Request() req,
    @Query('filter') filter: FilterSales,
    @Query('sortOrder') sortOrder: SortOrder = SortOrder.MOST_SOLD,
  ) {
    return this.dashboardService.getBundlesBySales(
      req.user.id,
      filter,
      sortOrder,
    );
  }
}
