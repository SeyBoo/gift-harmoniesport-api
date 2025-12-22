import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../payment/entities/order.entity';
import { Product } from '../../products/entities/product.entity';
import { AdminOrderController } from './admin-order.controller';
import { AdminOrderService } from './admin-order.service';
import { AdminOrderUtils } from './utils/admin-order.utils';
import { MailjetModule } from '../../common/mailjet/mailjet.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Product]), MailjetModule],
  controllers: [AdminOrderController],
  providers: [AdminOrderService, AdminOrderUtils],
  exports: [AdminOrderService],
})
export class AdminOrderModule {}
