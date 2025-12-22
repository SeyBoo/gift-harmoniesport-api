import { HttpException, HttpStatus } from '@nestjs/common';

export class PaymentException extends HttpException {
  constructor() {
    super('Payment failed', HttpStatus.FORBIDDEN);
  }
}
