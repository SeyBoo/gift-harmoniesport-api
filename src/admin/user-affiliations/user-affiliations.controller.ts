import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserAffiliationsService } from './user-affiliations.service';
import {
  ListAffiliationsDto,
  UpdateEarningDto,
  CreateAffiliationDto,
} from '../../common/dtos';
import { Roles } from '../../common/decorators/admin.decorator';
import { AdminRole } from '../entities/admin.entity';
import { JwtAuthGuardAdmin, RolesGuard } from '../auth/guards';

@Controller('admin/user-affiliations')
@UseGuards(JwtAuthGuardAdmin, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN)
export class UserAffiliationsController {
  constructor(
    private readonly userAffiliationsService: UserAffiliationsService,
  ) {}

  @Get()
  findAll(@Query() query: ListAffiliationsDto) {
    return this.userAffiliationsService.findAll(query);
  }

  @Post()
  create(@Body() createAffiliationDto: CreateAffiliationDto) {
    return this.userAffiliationsService.create(createAffiliationDto);
  }

  @Patch(':id/earning')
  updateEarning(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEarningDto: UpdateEarningDto,
  ) {
    return this.userAffiliationsService.updateEarning(id, updateEarningDto);
  }
}
