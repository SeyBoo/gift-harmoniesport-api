import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ThematicsModule } from './thematics/thematics.module';
import { WalletsModule } from './wallets/wallets.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CelebritiesModule } from './celebrities/celebrities.module';
import { ProductsModule } from './products/products.module';
import { PaymentModule } from './payment/payment.module';
import { MailjetModule } from './common/mailjet/mailjet.module';
import { GenaiModule } from './genai/genai.module';
import { UploadModule } from './common/upload/upload.module';
import { MassImportModule } from './common/upload/mass-import/mass-import.module';
import { InvoiceModule } from './invoice/invoice.module';
import { TranslatorModule } from './common/translator/translator.module';
import { GenimageModule } from './genimage/genimage.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { AdminModule } from './admin/admin.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { SponsorsModule } from './sponsors/sponsors.module';
import { AssociationModule } from './associations/association.module';
import { E2EModule } from './e2e/e2e.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TransactionsModule } from './transactions/transactions.module';
import { LegalModule } from './legal/legal.module';
import { OfferModule } from './offer/offer.module';
import { FaqModule } from './faq/faq.module';
import { SupportModule } from './support/support.module';
import { MessagingModule } from './messaging/messaging.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      migrations: [join(__dirname, './migrations/*{.ts,.js}')],
      autoLoadEntities: true,
      synchronize: false,
      migrationsRun: true,
      // logging: true,
      charset: 'utf8mb4',
      connectTimeout: 60000,
      acquireTimeout: 60000,
      ...(process.env.DATABASE_SSL
        ? {
            ssl: {
              rejectUnauthorized: false,
            },
          }
        : {}),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..'),
    }),
    AuthModule,
    UsersModule,
    ThematicsModule,
    WalletsModule,
    E2EModule,
    DashboardModule,
    CampaignsModule,
    CelebritiesModule,
    ProductsModule,
    PaymentModule,
    MailjetModule,
    GenaiModule,
    UploadModule,
    MassImportModule,
    InvoiceModule,
    TranslatorModule,
    GenimageModule,
    AdminModule,
    RabbitMQModule,
    SponsorsModule,
    AssociationModule,
    AnalyticsModule,
    TransactionsModule,
    LegalModule,
    OfferModule,
    FaqModule,
    SupportModule,
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
