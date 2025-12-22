import { HttpException, HttpStatus } from '@nestjs/common';

export class SoldOutException extends HttpException {
  constructor() {
    super('Sold out', HttpStatus.NOT_FOUND);
  }
}
