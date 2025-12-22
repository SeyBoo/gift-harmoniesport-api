import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { MassImportService } from './mass-import.service';
import { CreateMassImportSessionDto, PlayerCardItemDto } from './dto/create-mass-import-session.dto';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { MassImportItem } from './entities/mass-import-item.entity';

@Controller('mass-import')
@UseGuards(JwtAuthGuard)
export class MassImportController {
  constructor(private readonly massImportService: MassImportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req,
    @Body() createMassImportSessionDto: CreateMassImportSessionDto,
  ) {
    return this.massImportService.createMassImportSession(
      req.user.id,
      createMassImportSessionDto,
    );
  }

  @Get()
  async findAll(@Request() req) {
    return this.massImportService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.massImportService.findById(id);
  }

  @Post(':id/items')
  async addItemsToSession(
    @Param('id') sessionId: string,
    @Body() body: { items: PlayerCardItemDto[] },
  ) {
    return this.massImportService.addItemsToSession(sessionId, body.items);
  }

  @Delete(':sessionId/items/:itemId')
  async removeItemFromSession(
    @Param('sessionId') sessionId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.massImportService.removeItemFromSession(sessionId, itemId);
  }

  @Patch(':sessionId/items/:itemId')
  async updateItem(
    @Param('sessionId') sessionId: string,
    @Param('itemId') itemId: string,
    @Body() updateData: Partial<MassImportItem>,
  ) {
    return this.massImportService.updateItem(sessionId, itemId, updateData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.massImportService.deleteMassImportSession(id);
  }
}
