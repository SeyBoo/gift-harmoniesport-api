import {
  Controller,
  Post,
  Body,
  UseGuards,
  Put,
  Request,
} from '@nestjs/common';
import { OfferService } from './offer.service';
import { CreateOfferDto } from './dtos/createOffer.dto';
import { AdminGuard, JwtAuthGuardAdmin } from '../admin/auth/guards';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('offers')
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  @Post('/claim')
  @UseGuards(JwtAuthGuard)
  async claimOffer(@Body() body: { token: string }, @Request() req) {
    return await this.offerService.claimOffer(body.token, req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuardAdmin, AdminGuard)
  async createOffers(@Body() createOfferDto: CreateOfferDto[]) {
    const offers = await this.offerService.createOffer(createOfferDto);

    return {
      success: true,
      message: 'Offers created and emails sent successfully',
      data: offers,
    };
  }

  @Put()
  @UseGuards(JwtAuthGuardAdmin, AdminGuard)
  async sendEmailToAllOffers() {
    return await this.offerService.sendOfferEmails();
  }
}
