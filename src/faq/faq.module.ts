import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaqService } from './faq.service';
import { FaqController } from './faq.controller';
import { Faq } from './faq.entity';
import { TranslatorModule } from '../common/translator/translator.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Faq]),
    TranslatorModule,
  ],
  controllers: [FaqController],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
