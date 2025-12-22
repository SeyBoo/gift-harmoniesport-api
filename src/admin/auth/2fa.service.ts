import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { QRCodeService } from './qrcode.service';
import { Admin } from '../entities/admin.entity';
import { UserAdminService } from '../user-admin/user-admin.service';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly userAdminService: UserAdminService,
    private readonly qrCodeService: QRCodeService,
  ) {}

  async generateSecret(
    user: Admin,
  ): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'GiftAsso', secret);
    const qrCodeDataUrl = await this.qrCodeService.generateQRCode(otpauthUrl);

    await this.userAdminService.setTwoFactorSecret(user.id, secret);

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  async enableTwoFactor(userId: string, code: string): Promise<boolean> {
    const user = await this.userAdminService.findById(userId);
    if (!user || !user.twoFactorSecret) {
      return false;
    }

    const isCodeValid = user.verifyAuthenticatorCode(code);
    if (!isCodeValid) {
      return false;
    }
    await this.userAdminService.update(userId, { isTwoFactorEnabled: true });
    return true;
  }

  async disableTwoFactor(userId: string): Promise<boolean> {
    const user = await this.userAdminService.findById(userId);
    if (!user) {
      return false;
    }
    await this.userAdminService.update(userId, {
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
    });
    return true;
  }
}
