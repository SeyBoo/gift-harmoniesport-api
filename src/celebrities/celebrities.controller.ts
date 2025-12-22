import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { CelebritiesService } from './celebrities.service';
import { CreateCelebrityDto } from './dto/create-celebrity.dto';
import { UpdateCelebrityDto } from './dto/update-celebrity.dto';
import { Public } from '../common/decorators/public.decorator';
import { AdminGuard } from '../admin/auth/guards';
import { Pagination } from '../common/decorators';
import { PaginationDto } from '../common/dtos';
import { ChatGPTRequestDto } from './dto/ask-chatgpt.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AskCelebrityDto } from './dto/ask-celebrity.dto';

@Controller('celebrities')
export class CelebritiesController {
  constructor(private readonly celebritiesService: CelebritiesService) {}

  @UseGuards(AdminGuard)
  @Post()
  create(@Body() createCelebrityDto: CreateCelebrityDto) {
    return this.celebritiesService.create(createCelebrityDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ask')
  async askForNewCelebrity(@Body() payload: AskCelebrityDto, @Request() req) {
    return await this.celebritiesService.askForNewCelebrity(
      payload,
      parseInt(req.user.id),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/not-accepted/:id')
  async dontAcceptCelebrity(@Param('id') celebrityId: number) {
    return await this.celebritiesService.dontAcceptCelebrity(celebrityId);
  }

  @Public()
  @Get()
  findAll(
    @Pagination() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.celebritiesService.findAll(
      pagination.page,
      pagination.limit,
      search,
    );
  }

  @Public()
  @Get('/minified')
  findAllMinified(
    @Pagination() pagination: PaginationDto,
    @Query('search') search?: string,
    @Query('language') language?: string,
    @Query('associationId') associationId?: string,
  ) {
    return this.celebritiesService.findAllMinified(
      pagination.page,
      pagination.limit,
      language,
      search,
      associationId ? parseInt(associationId) : undefined,
    );
  }

  @Get('/:id')
  @Public()
  async findOne(@Param('id') id: string) {
    return await this.celebritiesService.findOne(+id);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCelebrityDto: UpdateCelebrityDto,
  ) {
    return this.celebritiesService.update(+id, updateCelebrityDto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.celebritiesService.remove(+id);
  }

  @Public()
  @Post('ask')
  async askQuestion(@Body() body: ChatGPTRequestDto) {
    return this.celebritiesService.askPerplexity(body);
  }

  @Public()
  @Post('ask-chatgpt')
  async askChatGPT(@Body() body: ChatGPTRequestDto) {
    return this.celebritiesService.askChatGPT(body);
  }
}
