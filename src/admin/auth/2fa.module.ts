import { Module } from '@nestjs/common';
import { QRCodeService } from './qrcode.service';
import { TwoFactorService } from './2fa.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../entities/admin.entity';
import { UserAdminService } from '../user-admin/user-admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([Admin])],
  providers: [TwoFactorService, QRCodeService, UserAdminService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
