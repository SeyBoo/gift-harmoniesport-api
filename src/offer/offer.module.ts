import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfferService } from './offer.service';
import { OfferController } from './offer.controller';
import { Offer } from './entity/offer.entity';
import { Product } from '../products/entities/product.entity';
import { SendGridService } from '../common/sendgrid/sendgrid.service';
import { User } from '../users/entities/user.entity';
import { UserProduct } from '../products/entities/userproduct.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Offer, UserProduct, Product, User])],
  controllers: [OfferController],
  providers: [OfferService, SendGridService],
  exports: [OfferService],
})
export class OfferModule {}
