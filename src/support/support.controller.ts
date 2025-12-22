import {
  Controller,
  Post,
  Body,
  Get,
  HttpStatus,
  HttpException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { SupportService } from './support.service';
import { ContactSupportDto } from './dto/contact-support.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Public()
  @Post('contact')
  async contactSupport(@Body() contactData: ContactSupportDto) {
    try {
      const result = await this.supportService.sendSupportMessage(contactData);
      return result;
    } catch {
      throw new HttpException(
        'Failed to send support message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('unfulfilled-orders')
  async getUnfulfilledOrders() {
    try {
      const orders = await this.supportService.getUnfulfilledOrders();
      return {
        success: true,
        data: orders,
        count: orders.length,
      };
    } catch {
      throw new HttpException(
        'Failed to fetch unfulfilled orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('send-weekly-recap')
  async sendWeeklyRecap() {
    try {
      const result = await this.supportService.sendWeeklyOrdersRecap();
      return result;
    } catch (error) {
      console.error('Error in sendWeeklyRecap controller:', error);
      throw new HttpException(
        'Failed to send weekly recap email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('unfulfilled-orders/export')
  async exportUnfulfilledOrdersCSV(@Res() res: Response) {
    try {
      const csvData = await this.supportService.exportUnfulfilledOrdersCSV();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="unfulfilled-orders.csv"',
      );
      res.send(csvData);
    } catch (error) {
      console.error('Error exporting unfulfilled orders:', error);
      throw new HttpException(
        'Failed to export unfulfilled orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
