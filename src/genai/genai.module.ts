import { Module } from '@nestjs/common';
import { GenaiService } from './genai.service';
import { UploadModule } from '../common/upload/upload.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [UploadModule, HttpModule],
  providers: [GenaiService],
  exports: [GenaiService],
})
export class GenaiModule {}
