import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { Campaign } from './entities/campaign.entity';
import { AuthModule } from '../auth/auth.module';
import { TranslatorModule } from '../common/translator/translator.module';
import { UploadModule } from '../common/upload/upload.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { UsersModule } from '../users/users.module';
import { Celebrity } from '../celebrities/entities/celebrity.entity';
import { Thematic } from '../thematics/entities/thematic.entity';
import { Product } from '../products/entities/product.entity';
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Campaign, Celebrity, Thematic, Product]),
    TranslatorModule,
    UploadModule,
    RabbitMQModule,
    UsersModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
