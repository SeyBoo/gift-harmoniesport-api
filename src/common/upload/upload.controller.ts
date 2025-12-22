import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Res,
  UseGuards,
  Request,
  Body,
  Put,
  Param,
  Get,
  Delete,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as stream from 'stream';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreateSessionDto, UpdateSessionDto, PresignedUrlDto } from '../dtos';
import axios from 'axios';

@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);
  private readonly allowedDomains = [
    'leons.ams3.cdn.digitaloceanspaces.com',
    'leons.ams3.digitaloceanspaces.com',
    'gift-asso.fra1.cdn.digitaloceanspaces.com',
    'gift-asso.fra1.digitaloceanspaces.com',
  ];

  constructor(private readonly uploadService: UploadService) {}

  @UseGuards(JwtAuthGuard)
  @Post('/presign')
  public async getPresignedUrl(@Body() body: PresignedUrlDto) {
    const { filename, contentType, folder } = body;
    const result = await this.uploadService.generatePresignedUrl(
      filename,
      contentType,
      folder,
    );
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('/confirm')
  public async confirmUpload(@Body() body: { key: string }) {
    await this.uploadService.setPublicAcl(body.key);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('/session')
  public async createUploadSession(
    @Request() req,
    @Body() body: CreateSessionDto,
  ) {
    const session = await this.uploadService.createUploadSession({
      userId: req?.user?.id,
      ...body,
    });
    return {
      success: true,
      id: session.id,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('/session/:id')
  public async updateUploadSession(
    @Param('id') id: string,
    @Body() body: UpdateSessionDto,
  ) {
    await this.uploadService.updateUploadSession(id, body);
    return {
      success: true,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/session/:id')
  public async fetchUploadSession(@Param('id') id: string) {
    return await this.uploadService.getUploadSession({ id });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/session/item/:id')
  public async deleteUploadItem(@Param('id') id: string) {
    await this.uploadService.deleteUploadItem(id);
    return {
      success: true,
    };
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  public async upload(
    @UploadedFile() file: Express.Multer.File,
    @Res() response: Response,
  ) {
    try {
      const buffer = await this.uploadService.processImage(file.buffer);

      response.set({
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'attachment; filename="downloaded-image.jpg"',
      });
      response.status(200);

      const readStream = new stream.PassThrough();
      readStream.end(buffer);

      readStream.pipe(response);
    } catch (error) {
      console.error('Error uploading file:', error);
      response.status(500).send('An error occurred while processing the file.');
    }
  }

  /**
   * Image proxy endpoint to bypass CORS restrictions for external images.
   * Used by html2canvas to capture images from DigitalOcean Spaces CDN.
   *
   * Usage: GET /upload/proxy-image?url=https://leons.ams3.cdn.digitaloceanspaces.com/...
   */
  @Get('/proxy-image')
  public async proxyImage(
    @Query('url') url: string,
    @Res() response: Response,
  ) {
    if (!url) {
      throw new BadRequestException('Missing url parameter');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    if (!this.allowedDomains.includes(parsedUrl.hostname)) {
      throw new BadRequestException(
        `Domain not allowed. Allowed domains: ${this.allowedDomains.join(', ')}`,
      );
    }

    try {
      const imageResponse = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'GiftassoImageProxy/1.0',
        },
        timeout: 10000,
      });

      const contentType = imageResponse.headers['content-type'];

      if (!contentType?.startsWith('image/')) {
        throw new BadRequestException('URL does not point to an image');
      }

      response.set({
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      });

      response.status(200).send(Buffer.from(imageResponse.data));
    } catch (error) {
      this.logger.error(`Error proxying image from ${url}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      response.status(500).send('Failed to proxy image');
    }
  }
}
