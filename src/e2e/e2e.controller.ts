import { Body, Controller, Delete, Post } from '@nestjs/common';
import { E2EDonatorService } from './utils/e2e.donator';

@Controller('e2e')
export class E2EController {
  constructor(private readonly e2eDonatorService: E2EDonatorService) {}

  @Delete('donator')
  async deleteDonator(@Body() body: { email: string }) {
    return await this.e2eDonatorService.deleteDonator(body.email);
  }

  @Post('donator')
  async createDonator(@Body() body: { email: string }) {
    return await this.e2eDonatorService.createDonator(body.email);
  }
}
