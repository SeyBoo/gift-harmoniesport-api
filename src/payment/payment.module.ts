import { Module, NestModule, MiddlewareConsumer, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { StripeService } from './stripe.service';
import { UsersModule } from '../users/users.module';
import { GenaiModule } from '../genai/genai.module';
import { MailjetModule } from '../common/mailjet/mailjet.module';
import { ProductsModule } from '../products/products.module';
import { VivaWalletService } from './vivawallet.service';
import { InvoiceModule } from '../invoice/invoice.module';
import { UploadModule } from '../common/upload/upload.module';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TranslatorModule } from '../common/translator/translator.module';
import { HttpModule } from '@nestjs/axios';
import { RawBodyMiddleware } from '../common/pipes/raw-body.pipe';
import { TransactionsModule } from '../transactions/transactions.module';
import { StripeWebhookHandler } from './webhooks/stripe-webhook.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    forwardRef(() => UsersModule),
    HttpModule,
    GenaiModule,
    MailjetModule,
    forwardRef(() => ProductsModule),
    InvoiceModule,
    UploadModule,
    MulterModule.register({
      storage: memoryStorage(),
    }),
    TranslatorModule,
    TransactionsModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, StripeService, VivaWalletService, StripeWebhookHandler],
  exports: [PaymentService],
})
export class PaymentModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RawBodyMiddleware)
      .forRoutes('order/webhook/stripe');
  }
}
