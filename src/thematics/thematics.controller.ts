import { Controller, Get, Param } from '@nestjs/common';
import { ThematicsService } from './thematics.service';
import { Public } from '../common/decorators';

@Controller('thematics')
export class ThematicsController {
  constructor(private readonly thematicsService: ThematicsService) {}

  @Public()
  @Get()
  findAll() {
    return this.thematicsService.findAll();
  }

  @Public()
  @Get(':id')
  findAllSubThematicsByThematicId(@Param('id') id: string) {
    return this.thematicsService.findAllSubThematicsByThematicId(+id);
  }
}
