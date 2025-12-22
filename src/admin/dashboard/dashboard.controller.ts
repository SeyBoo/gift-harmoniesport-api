import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';

@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  async getDashboardMetrics(@Query() query: DashboardMetricsDto) {
    return this.dashboardService.getDashboardMetrics(query);
  }
} 