import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Put,
} from '@nestjs/common';
import { FaqService } from './faq.service';
import {
  CreateFaqDto,
  UpdateFaqDto,
  ListFaqDto,
  BulkImportFaqDto,
} from './dto';
import { JwtAuthGuardAdmin, AdminGuard } from '../admin/auth/guards';
import { IsAdmin } from '../common/decorators/admin.decorator';
import { Public } from '../common/decorators';
import { SupportedLanguage } from '../common/translator/translator.constant';

@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Post()
  @UseGuards(JwtAuthGuardAdmin, AdminGuard)
  @IsAdmin()
  async createFaq(@Body() createFaqDto: CreateFaqDto) {
    const faq = await this.faqService.createFaq(createFaqDto);
    return {
      message: 'FAQ created successfully',
      data: faq,
    };
  }

  @Get()
  @Public()
  async findAllFaqs(
    @Query() listFaqDto: ListFaqDto,
    @Query('language') language?: SupportedLanguage,
  ) {
    if (language) {
      const faqs = await this.faqService.getFaqsForPublicDisplay(
        language,
        listFaqDto.category,
        listFaqDto.search,
      );
      return {
        data: faqs,
        total: faqs.length,
      };
    }
    return this.faqService.findAllFaqs(listFaqDto);
  }

  @Get('categories')
  @Public()
  async getCategories(@Query('language') language?: SupportedLanguage) {
    const categories = await this.faqService.getCategories(language);
    return {
      data: categories,
    };
  }

  @Post('bulk-import')
  @UseGuards(JwtAuthGuardAdmin, AdminGuard)
  @IsAdmin()
  async bulkImportFaqs(@Body() bulkImportDto: BulkImportFaqDto) {
    const result = await this.faqService.bulkImportFaqs(bulkImportDto);
    return {
      message: result.success
        ? `Successfully imported ${result.imported} FAQs`
        : 'Bulk import completed with errors',
      ...result,
    };
  }

  @Get(':id')
  @Public()
  async findOneFaq(
    @Param('id') id: string,
    @Query('language') language?: SupportedLanguage,
  ) {
    const faq = await this.faqService.findOneFaq(id);

    if (language) {
      return {
        id: faq.id,
        question:
          faq.question[language] ||
          faq.question['fr'] ||
          Object.values(faq.question)[0],
        answer:
          faq.answer[language] ||
          faq.answer['fr'] ||
          Object.values(faq.answer)[0],
        category: faq.category
          ? faq.category[language] ||
            faq.category['fr'] ||
            Object.values(faq.category)[0]
          : null,
        createdAt: faq.createdAt,
        updatedAt: faq.updatedAt,
      };
    }

    return faq;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuardAdmin, AdminGuard)
  @IsAdmin()
  async updateFaq(@Param('id') id: string, @Body() updateFaqDto: UpdateFaqDto) {
    const faq = await this.faqService.updateFaq(id, updateFaqDto);
    return {
      message: 'FAQ updated successfully',
      data: faq,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuardAdmin, AdminGuard)
  @IsAdmin()
  async removeFaq(@Param('id') id: string) {
    await this.faqService.removeFaq(id);
    return {
      message: 'FAQ deleted successfully',
    };
  }
}
