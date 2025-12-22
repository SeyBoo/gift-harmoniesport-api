import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsService } from '../wallets/wallets.service';
import { MailjetService } from '../common/mailjet/mailjet.service';
import { EmailService } from '../common/email/email.service';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserProduct } from '../products/entities/userproduct.entity';
import { Order } from '../payment/entities/order.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Product } from '../products/entities/product.entity';
import { Label } from './entities/label.entity';
import { UserType } from './entities/user-type.entity';
import { UserAiGeneration } from './entities/user-ai-generation.entity';
import { UserAffiliation } from './entities/user-affiliation.entity';
import { UserTransaction } from './entities/user-transaction.entity';
import { UserWithdrawal } from './entities/user-withdrawal.entity';
import { UploadModule } from '../common/upload/upload.module';
import { TranslatorModule } from '../common/translator/translator.module';
import { AuthModule } from '../auth/auth.module';
import { HttpModule } from '@nestjs/axios';
import { PaymentModule } from '../payment/payment.module';
import { TransactionsModule } from '../transactions/transactions.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Wallet,
      UserProduct,
      Order,
      Product,
      Label,
      UserType,
      UserAiGeneration,
      UserAffiliation,
      UserTransaction,
      UserWithdrawal,
    ]),
    UploadModule,
    TranslatorModule,
    forwardRef(() => AuthModule),
    HttpModule,
    TransactionsModule,
    forwardRef(() => PaymentModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, WalletsService, MailjetService, EmailService],
  exports: [UsersService],
})
export class UsersModule {}
