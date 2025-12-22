import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { LegalService } from './legal.service';
import { LegalLanguage } from './legal.types';
import { LegalType } from './legal.types';
import { AdminGuard } from '../admin/auth/guards';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('/:type')
  async getLegal(
    @Param('type') type: LegalType,
    @Query('language') language: LegalLanguage,
  ) {
    return this.legalService.getLegal(type, language);
  }

  @Post('translate')
  async translateLegal(
    @Body('content') content: string,
    @Body('targetLanguage') targetLanguage: string,
  ) {
    if (!content || !targetLanguage) {
      throw new Error('Missing content or targetLanguage');
    }

    const translatedContent = await this.legalService.translateWithGpt(
      content,
      targetLanguage,
    );

    return { translatedContent };
  }

  @Post('/convert-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async convertPdfToMarkdown(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    return await this.legalService.convertPdfToMarkdown(file);
  }

  @Post('/:type')
  @UseGuards(AdminGuard)
  async createLegal(
    @Param('type') type: LegalType,
    @Query('language') language: LegalLanguage,
    @Body('content') content: string,
  ) {
    return this.legalService.createLegal(type, language, content);
  }

  @Put('/:id')
  @UseGuards(AdminGuard)
  async updateLegal(@Param('id') id: number, @Body('content') content: string) {
    return this.legalService.updateLegal(id, content);
  }

  @Get()
  async getAllLegalDocuments() {
    return this.legalService.getAllLegalDocuments();
  }
}
