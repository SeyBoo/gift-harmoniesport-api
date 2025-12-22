import { Module } from '@nestjs/common';
import { UserAdminService } from './user-admin.service';
import { Admin } from '../entities/admin.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAdminController } from './user-admin.controller';
import { TwoFactorModule } from '../auth/2fa.module';

@Module({
  imports: [TypeOrmModule.forFeature([Admin]), TwoFactorModule],
  providers: [UserAdminService],
  exports: [UserAdminService],
  controllers: [UserAdminController],
})
export class UserAdminModule {}
