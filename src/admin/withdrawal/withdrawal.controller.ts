import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuardAdmin, RolesGuard } from '../auth/guards';
import { Roles } from '../../common/decorators/admin.decorator';
import { AdminRole } from '../entities/admin.entity';
import { WithdrawalService } from './withdrawal.service';
import { ListWithdrawalsDto, ProcessWithdrawalDto } from '../../common/dtos';
import { Pagination } from '../../common/decorators';
import { WithdrawalStatus } from '../../users/entities/user-withdrawal.entity';

@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuardAdmin, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN)
export class WithdrawalController {
  constructor(private readonly withdrawalsService: WithdrawalService) {}

  @Get()
  async listWithdrawals(
    @Pagination() pagination: ListWithdrawalsDto,
    @Query('status') status?: WithdrawalStatus,
    @Query('userId') userId?: number,
  ) {
    return this.withdrawalsService.listWithdrawals({
      ...pagination,
      status,
      userId,
    });
  }

  @Post(':id/process')
  async processWithdrawal(
    @Param('id') id: number,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.withdrawalsService.processWithdrawal(id, dto);
  }
}
