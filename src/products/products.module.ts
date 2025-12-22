import { Module, forwardRef } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserProduct } from './entities/userproduct.entity';
import { AuthModule } from '../auth/auth.module';
import { GenaiModule } from '../genai/genai.module';
import { UserAiGeneration } from '../users/entities/user-ai-generation.entity';
import { UploadModule } from '../common/upload/upload.module';
import { GenimageModule } from '../genimage/genimage.module';
import { TranslatorModule } from '../common/translator/translator.module';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { UsersModule } from '../users/users.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { User } from '../users/entities/user.entity';
import { Celebrity } from '../celebrities/entities/celebrity.entity';
import { MailjetModule } from '../common/mailjet/mailjet.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    GenaiModule,
    GenimageModule,
    AuthModule,
    UploadModule,
    MailjetModule,
    HttpModule,
    TypeOrmModule.forFeature([
      Product,
      Campaign,
      UserProduct,
      UserAiGeneration,
      User,
      Celebrity,
    ]),
    MulterModule.register({
      storage: memoryStorage(),
    }),
    TranslatorModule,
    forwardRef(() => UsersModule),
    RabbitMQModule,
  ],

  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
