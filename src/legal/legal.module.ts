import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Legal } from './model/legal.entity';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';

@Module({
  imports: [TypeOrmModule.forFeature([Legal])],
  controllers: [LegalController],
  providers: [LegalService],
  exports: [LegalService],
})

export class LegalModule {}