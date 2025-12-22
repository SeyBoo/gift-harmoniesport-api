import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { GcpEmailConnector } from './connectors/gcp-email.connector';
import { WhatsAppConnector } from './connectors/whatsapp.connector';
import { User } from '../users/entities/user.entity';
import { Order } from '../payment/entities/order.entity';
import { Email } from './entities/email.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Order, Email])],
  controllers: [MessagingController],
  providers: [MessagingService, GcpEmailConnector, WhatsAppConnector],
  exports: [MessagingService],
})
export class MessagingModule {}
