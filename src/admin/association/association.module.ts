import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssociationsController } from './association.controller';
import { AssociationsService } from './association.service';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../payment/entities/order.entity';
import { UserAffiliation } from '../../users/entities/user-affiliation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Order,
      Product,
      UserAffiliation
    ])
  ],
  controllers: [AssociationsController],
  providers: [AssociationsService],
  exports: [AssociationsService],
})
export class AssociationsModule {}
