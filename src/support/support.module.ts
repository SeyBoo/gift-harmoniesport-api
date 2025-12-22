import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from '../common/email/email.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { Order } from '../payment/entities/order.entity';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Product])],
  controllers: [SupportController],
  providers: [SupportService, EmailService],
  exports: [SupportService],
})
export class SupportModule {}
