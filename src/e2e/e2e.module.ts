import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { E2EDonatorService } from './utils/e2e.donator';
import { Order } from '../payment/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';
import { UserType } from '../users/entities/user-type.entity';
import { UserProduct } from '../products/entities/userproduct.entity';
import { Thematic } from '../thematics/entities/thematic.entity';
import { UsersModule } from '../users/users.module';
import { E2EController } from './e2e.controller';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      Order,
      User,
      Product,
      Thematic,
      UserType,
      UserProduct,
    ]),
  ],
  providers: [E2EDonatorService],
  controllers: [E2EController],
})
export class E2EModule {}
