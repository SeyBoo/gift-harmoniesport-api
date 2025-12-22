import {
  Controller,
  Get,
  Patch,
  Query,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuardAdmin } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AssociationsService } from './association.service';
import { ListAssociationsDto, ToggleStatusDto, GetDashboardMetricsDto } from '../../common/dtos';

@Controller('admin/associations')
@UseGuards(JwtAuthGuardAdmin, AdminGuard)
export class AssociationsController {
  constructor(private readonly associationsService: AssociationsService) {}

  @Get()
  async listAssociations(@Query() queryParams: ListAssociationsDto) {
    return this.associationsService.listAssociations(queryParams);
  }

  @Get(':id')
  async getAssociationDetails(@Param('id') id: number) {
    return await this.associationsService.getAssociationDetails(id);
  }

  @Patch(':id/status')
  async toggleStatus(
    @Param('id') id: number,
    @Body() toggleStatusDto: ToggleStatusDto,
  ) {
    return this.associationsService.toggleStatus(id, toggleStatusDto.isActive);
  }

  @Get(':id/dashboard')
  async getDashboard(
    @Param('id', ParseIntPipe) id: number,
    @Query() dashboardDto: GetDashboardMetricsDto,
  ) {
    return this.associationsService.getDashboardMetrics(id, dashboardDto);
  }

}
