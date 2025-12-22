import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CelebritiesService } from './celebrities.service';
import { CelebritiesController } from './celebrities.controller';
import { Celebrity } from './entities/celebrity.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { TranslatorModule } from '../common/translator/translator.module';
import { CelebritiesUtils } from './utils/celebrities.utils';
import { HttpModule } from '@nestjs/axios';
@Module({
  imports: [
    TypeOrmModule.forFeature([Celebrity, Product, User]),
    TranslatorModule,
    HttpModule,
  ],
  controllers: [CelebritiesController],
  providers: [CelebritiesService, CelebritiesUtils],
})
export class CelebritiesModule {}
