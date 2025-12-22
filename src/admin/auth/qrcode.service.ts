import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QRCodeService {
  async generateQRCode(data: string): Promise<string> {
    try {
      return await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        margin: 4,
        width: 200,
      });
    } catch (err) {
      throw new Error(`Failed to generate QR code: ${err.message}`);
    }
  }
}
