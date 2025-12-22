import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminOrderService } from './admin-order.service';
import { PaginationDto } from '../../common/dtos';
import { Roles } from '../../common/decorators/admin.decorator';
import { JwtAuthGuardAdmin, RolesGuard } from '../auth/guards';
import { AdminRole } from '../entities/admin.entity';
import { DELIVERY_STATUS } from '../../payment/entities/order.entity';

@Controller('admin/order')
@UseGuards(JwtAuthGuardAdmin, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN)
export class AdminOrderController {
  constructor(private readonly adminOrderService: AdminOrderService) {}

  @Get()
  async findAllOrders(
    @Query() pagination: PaginationDto,
    @Query('associationId') associationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminOrderService.findAllOrders(
      pagination,
      associationId ? Number(associationId) : null,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null,
    );
  }

  @Put(':id')
  async updateOrderStatus(
    @Param('id') id: number,
    @Body()
    body: {
      delivery_status: DELIVERY_STATUS;
    },
  ) {
    return this.adminOrderService.updateOrderStatus(
      id,
      body.delivery_status,
    );
  }
}
