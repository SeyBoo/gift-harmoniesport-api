import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadSession } from './entities/upload-session.entity';
import { UploadItem } from './entities/upload-item.entity';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TypeOrmModule.forFeature([UploadSession, UploadItem]), 
    HttpModule
  ],
  providers: [UploadService],
  exports: [UploadService],
  controllers: [UploadController],
})
export class UploadModule {}
