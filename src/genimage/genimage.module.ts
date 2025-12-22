import { Module } from '@nestjs/common';
import { GenimageService } from './genimage.service';
import { UploadModule } from '../common/upload/upload.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [UploadModule, HttpModule],
  providers: [GenimageService],
  exports: [GenimageService],
})
export class GenimageModule {}
