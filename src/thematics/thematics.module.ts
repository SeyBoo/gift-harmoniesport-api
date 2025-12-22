import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThematicsService } from './thematics.service';
import { ThematicsController } from './thematics.controller';
import { Thematic } from './entities/thematic.entity';
import { SubThematic } from './entities/sub_thematic.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Thematic, SubThematic])],
  controllers: [ThematicsController],
  providers: [ThematicsService],
})
export class ThematicsModule {}
