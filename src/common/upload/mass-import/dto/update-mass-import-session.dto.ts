import { PartialType } from '@nestjs/mapped-types';
import { CreateMassImportSessionDto } from './create-mass-import-session.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { MassImportStatus } from '../entities/mass-import-session.entity';

export class UpdateMassImportSessionDto extends PartialType(CreateMassImportSessionDto) {
  @IsOptional()
  @IsEnum(MassImportStatus)
  status?: MassImportStatus;
}
