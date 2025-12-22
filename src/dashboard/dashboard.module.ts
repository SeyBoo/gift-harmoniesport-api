import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Order } from '../payment/entities/order.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Campaign])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
