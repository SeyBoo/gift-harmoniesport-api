import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Headers,
  ForbiddenException,
  Request,
  NotFoundException,
  BadRequestException,
  UploadedFiles,
  Put,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CampaignsService } from './campaigns.service';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { Express } from 'express';
import { RabbitMQService } from '../rabbitmq/rabbitmq.producer.service';
import { CreateCardBulkDto } from '../common/dtos';
import { UsersService } from '../users/users.service';
import { UserTypeEnum } from '../users/entities/user-type.entity';
import { TagOption } from './entities/campaign.entity';
import { UploadService } from '../common/upload/upload.service';
import { convert } from 'heic-convert';

@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly rabbitMQService: RabbitMQService,
    private authService: AuthService,
    private readonly userService: UsersService,
    private readonly uploadService: UploadService,
  ) {}

  @Public()
  @Post()
  @UseInterceptors(
    FileInterceptor('video', {
      storage: memoryStorage(),
    }),
  )
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createCampaignDto: any,
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') userHeader: string,
  ) {
    const token = userHeader.split(' ')[1];
    const profile = this.authService.getProfile(token);
    if (profile) {
      createCampaignDto.user = profile.sub;
    }
    return this.campaignsService.create(createCampaignDto, file);
  }

  @Post('card/bulk')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
    }),
  )
  async createCardItem(
    @Body() createCampaignDto: CreateCardBulkDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const association = await this.userService.findAnUser({
      id: createCampaignDto.associationId,
      userType: {
        name: UserTypeEnum.ASSOCIATION,
      },
    });
    if (!association) {
      throw new ForbiddenException('Missing valid association');
    }
    if (!file) {
      throw new ForbiddenException('Missing player face');
    }
    this.rabbitMQService.send('rabbit-mq-producer', {
      ...createCampaignDto,
      price: {
        'bundle-premium': createCampaignDto['bundle-premium'],
        'bundle-plus': createCampaignDto['bundle-plus'],
        'bundle-basic': createCampaignDto['bundle-basic'],
        'bundle-digital': createCampaignDto['bundle-digital'],
      },
      associationImage: association.logo,
      playerFace: {
        filename: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer.toString('base64'),
      },
    });
    return {
      success: true,
    };
  }

  @Get()
  findAll() {
    return this.campaignsService.findAll();
  }

  @Public()
  @Get('mycampaigns')
  async findAllMyCampaigns(@Headers('authorization') userHeader: string) {
    const token = userHeader.split(' ')[1];
    const profile = this.authService.getProfile(token);

    if (profile) {
      const a = await this.campaignsService.findAllMyCampaigns(+profile.sub);
      return a;
    }
  }

  @Public()
  @Get('tags')
  getTagOptions() {
    return Object.values(TagOption);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) {
      throw new NotFoundException(`Invalid campaign ID format: ${id}`);
    }
    return await this.campaignsService.findOne(campaignId, req.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
    @Request() req: any,
  ) {
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) {
      throw new NotFoundException(`Invalid campaign ID format: ${id}`);
    }
    return await this.campaignsService.update(
      campaignId,
      updateCampaignDto,
      req.user.id,
    );
  }

  @Put('/upload-banner')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      {
        name: 'banner_image',
        maxCount: 1,
      },
    ]),
  )
  async uploadBackgroundImage(
    @UploadedFiles()
    files: {
      banner_image?: Express.Multer.File[];
    },
    @Request() req,
    @Body('campaignId') campaignId?: string,
  ): Promise<{ imageUrl: string }> {
    const { banner_image } = files;

    if (!banner_image || !banner_image[0]) {
      throw new BadRequestException('A background image file is required');
    }

    try {
      let fileBuffer = banner_image[0].buffer;
      let fileType = banner_image[0].mimetype.split('/')[1];

      if (fileType === 'heic') {
        const outputBuffer = await convert({
          buffer: fileBuffer,
          format: 'JPEG',
          quality: 1,
        });

        fileBuffer = outputBuffer;
        fileType = 'jpeg';
      }
  
      const uploadedFileUrl = await this.uploadService.uploadFile(fileBuffer, {
        ContentType: `image/${fileType}`,
        Key: `campaigns/banner/${Date.now()}.${fileType}`,
      });
  
      if (campaignId) {
        await this.campaignsService.updateBackgroundImage(parseInt(campaignId), uploadedFileUrl, req.user.id);
      }
  
      return { imageUrl: uploadedFileUrl };
    } catch (error) {
      throw new BadRequestException(`Banner image upload failed: ${error.message}`);
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Request() req: any) {
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) {
      throw new NotFoundException(`Invalid campaign ID format: ${id}`);
    }
    return await this.campaignsService.remove(campaignId, req.user.id);
  }
}
