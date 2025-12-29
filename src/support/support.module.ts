import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailjetService } from '../common/mailjet/mailjet.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { Order } from '../payment/entities/order.entity';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Product])],
  controllers: [SupportController],
  providers: [SupportService, MailjetService],
  exports: [SupportService],
})
export class SupportModule {}
