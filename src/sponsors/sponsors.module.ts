import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sponsor } from './entity/sponsors.entity';
import { SponsorsController } from './sponsors.controller';
import { SponsorsService } from './sponsors.service';
import { User } from '../users/entities/user.entity';
import { UploadModule } from '../common/upload/upload.module';

@Module({
  imports: [TypeOrmModule.forFeature([Sponsor, User]), UploadModule],
  controllers: [SponsorsController],
  providers: [SponsorsService],
  exports: [SponsorsService],
})
export class SponsorsModule {}
