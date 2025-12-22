import { Module } from '@nestjs/common';
import { TranslatorService } from './translator.service';

@Module({
  imports: [],
  providers: [TranslatorService],
  exports: [TranslatorService],
})
export class TranslatorModule {}
