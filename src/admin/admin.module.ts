import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from './entities/admin.entity';
import { AuthModule } from './auth/auth.module';
import { UserAdminService } from './user-admin/user-admin.service';
import { UserAdminModule } from './user-admin/user-admin.module';
import { TwoFactorModule } from './auth/2fa.module';
import { AssociationsService } from './association/association.service';
import { AssociationsModule } from './association/association.module';
import { User } from '../users/entities/user.entity';
import { WithdrawalModule } from './withdrawal/withdrawal.module';
import { UserAffiliationsModule } from './user-affiliations/user-affiliations.module';
import { AdminOrderModule } from './order/admin-order.module';
import { Order } from '../payment/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { UserAffiliation } from '../users/entities/user-affiliation.entity';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, User, Order, Product, UserAffiliation]),
    AuthModule,
    UserAdminModule,
    TwoFactorModule,
    AssociationsModule,
    WithdrawalModule,
    UserAffiliationsModule,
    AdminOrderModule,
    DashboardModule,
  ],
  controllers: [],
  providers: [AdminService, UserAdminService, AssociationsService],
})
export class AdminModule { }
