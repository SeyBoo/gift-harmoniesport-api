import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UploadedFiles,
  UseInterceptors,
  Get,
} from '@nestjs/common';
import { SponsorsService } from './sponsors.service';
import { SuccessResponse } from '../common/interfaces';
import { Sponsor } from './entity/sponsors.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('sponsors')
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      {
        name: 'logo',
        maxCount: 1,
      },
    ]),
  )
  @UseGuards(JwtAuthGuard)
  async createSponsor(
    @Body() sponsor: Sponsor,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
    },
    @Request() req,
  ): Promise<SuccessResponse<Sponsor>> {
    return await this.sponsorsService.createSponsor(
      sponsor,
      req.user.id,
      files.logo[0],
    );
  }

  @Put(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      {
        name: 'logo',
        maxCount: 1,
      },
    ]),
  )
  @UseGuards(JwtAuthGuard)
  async updateSponsor(
    @Param('id') id: string,
    @Body() sponsor: Sponsor,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
    },
    @Request() req,
  ): Promise<SuccessResponse<Sponsor>> {
    return this.sponsorsService.updateSponsor(
      parseInt(id),
      sponsor,
      files.logo ? files.logo[0] : undefined,
      req.user.id,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteSponsor(
    @Param('id') id: string,
    @Request() req,
  ): Promise<SuccessResponse<void>> {
    return this.sponsorsService.deleteSponsor(parseInt(id), req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getSponsors(@Request() req): Promise<SuccessResponse<Sponsor[]>> {
    return this.sponsorsService.getSponsors(req.user.id);
  }
}
