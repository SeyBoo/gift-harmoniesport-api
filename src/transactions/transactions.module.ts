import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entity/transactions.entity';
import { MailjetModule } from '../common/mailjet/mailjet.module';
import { Product } from '../products/entities/product.entity';
import { Order } from '../payment/entities/order.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Product, Order, User]),
    MailjetModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
