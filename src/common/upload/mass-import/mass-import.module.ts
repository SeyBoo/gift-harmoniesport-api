import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MassImportController } from './mass-import.controller';
import { MassImportService } from './mass-import.service';
import { MassImportSession } from './entities/mass-import-session.entity';
import { MassImportItem } from './entities/mass-import-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MassImportSession, MassImportItem]),
  ],
  controllers: [MassImportController],
  providers: [MassImportService],
  exports: [MassImportService],
})
export class MassImportModule {}
