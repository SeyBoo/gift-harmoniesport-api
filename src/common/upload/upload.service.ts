import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  DeleteObjectCommand,
  ObjectCannedACL,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { UploadSession } from './entities/upload-session.entity';
import { FindOptionsWhere, Repository, UpdateResult } from 'typeorm';
import { UploadItem } from './entities/upload-item.entity';
import { PDFDocument } from 'pdf-lib';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly s3Uri: string;
  private readonly s3Prefix: string;

  private getPrefix(): string {
    return this.s3Prefix ? `${this.s3Prefix}/` : '';
  }

  public get FIELD_TO_PATH_UPLOAD() {
    const prefix = this.getPrefix();
    return {
      video_promo: `${prefix}uploads/videos-promo`,
      video_thanks: `${prefix}uploads/videos-thanks`,
      image: `${prefix}uploads/cards-image`,
      collector_image: `${prefix}uploads/cards-collector`,
      digital_image: `${prefix}uploads/cards-digital`,
      magnet_image: `${prefix}uploads/cards-magnet`,
      pdf: `${prefix}uploads/cards-pdf`,
    };
  }

  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
    @InjectRepository(UploadSession)
    private readonly uploadSessionRepository: Repository<UploadSession>,
    @InjectRepository(UploadItem)
    private readonly uploadItemRepository: Repository<UploadItem>,
  ) {
    this.bucketName = this.configService.get<string>('AWS_BUCKET');
    this.s3Uri = this.configService.get<string>('AWS_CDN');
    this.s3Prefix = this.configService.get<string>('AWS_PREFIX') || '';
    const endpoint = this.configService.get<string>('AWS_ENDPOINT');
    const region = this.configService.get<string>('AWS_REGION') || 'ams3';
    const accessKeyId = this.configService.get<string>('BUCKET_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('BUCKET_SECRET_KEY');

    this.logger.log(`=== S3 Configuration ===`);
    this.logger.log(`Bucket: ${this.bucketName}`);
    this.logger.log(`CDN URI: ${this.s3Uri}`);
    this.logger.log(`Region: ${region}`);
    this.logger.log(`Endpoint: ${endpoint || 'default AWS'}`);
    this.logger.log(`Access Key ID: ${accessKeyId ? accessKeyId.substring(0, 8) + '...' : 'MISSING'}`);
    this.logger.log(`Secret Key: ${secretAccessKey ? '****' : 'MISSING'}`);

    this.s3Client = new S3Client({
      region,
      ...(endpoint && { endpoint }),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }),
    );
  }

  // ACLs disabled - using bucket policy for public access instead
  async setPublicAcl(key: string): Promise<void> {
    // No-op: bucket policy handles public access
    this.logger.debug(`setPublicAcl called for ${key} - using bucket policy`);
  }

  public getS3Uri(): string {
    return this.s3Uri;
  }

  async generatePresignedUrl(
    filename: string,
    contentType: string,
    folder: string,
  ): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1e9);
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${timestamp}-${randomSuffix}-${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      ACL: ObjectCannedACL.public_read,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600, // 1 hour
      signableHeaders: new Set(['host', 'x-amz-acl', 'content-type']),
    });

    const fileUrl = `${this.s3Uri}/${key}`;

    return { uploadUrl, fileUrl, key };
  }

  async createUploadSession(
    data: Partial<UploadSession>,
  ): Promise<UploadSession> {
    const session = this.uploadSessionRepository.create(data);
    return this.uploadSessionRepository.save(session);
  }

  async deleteUploadItem(id: string): Promise<boolean> {
    await this.uploadItemRepository.delete({
      id,
    });
    return true;
  }

  async updateUploadSession(
    id: string,
    data: Partial<UploadSession>,
  ): Promise<UpdateResult> {
    return this.uploadSessionRepository.update(id, data);
  }

  async getUploadSession(
    where: FindOptionsWhere<UploadSession>,
  ): Promise<UploadSession> {
    return this.uploadSessionRepository.findOne({
      where,
      relations: ['uploadItems'],
    });
  }

  private isPdf(contentType: string): boolean {
    return contentType === 'application/pdf';
  }

  public async convertPdfToImage(pdfBuffer: Buffer): Promise<Buffer> {
    try {
      this.logger.log('Converting PDF to PNG using external API');

      const formData = new FormData();

      formData.append(
        'file',
        new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }),
      );

      const response = await this.httpService.axiosRef.post(
        'https://kconnv5tklt5utgs3vknc7h3aq0rloto.lambda-url.us-east-1.on.aws/pdf-to-png',
        formData,
        {
          responseType: 'arraybuffer',
        },
      );

      const pngBuffer = Buffer.from(response.data);

      this.logger.log(
        `PDF converted to PNG via API, size: ${pngBuffer.length} bytes`,
      );

      return pngBuffer;
    } catch (error) {
      this.logger.error('Error in PDF to PNG conversion API call:', error);
      return await this.createErrorImage();
    }
  }

  // Create a simple error image
  private async createErrorImage(): Promise<Buffer> {
    return await sharp({
      create: {
        width: 800,
        height: 1000,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="800" height="1000">' +
              '<text x="50%" y="50%" font-family="Arial" font-size="24" fill="black" text-anchor="middle">PDF Preview Unavailable</text>' +
              '</svg>',
          ),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();
  }

  // Helper method to extract PDF dimensions (unchanged)
  private async extractPdfMetadata(
    pdfBuffer: Buffer,
  ): Promise<{ width: number; height: number } | null> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();

      if (pages.length === 0) {
        return null;
      }

      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      // Convert PDF points to pixels (approximate)
      const pxWidth = Math.round(width * 1.5);
      const pxHeight = Math.round(height * 1.5);

      return { width: pxWidth, height: pxHeight };
    } catch (error) {
      this.logger.error('Failed to extract PDF metadata:', error);
      return null;
    }
  }

  public async uploadFile(
    body: Buffer,
    options?: Partial<PutObjectCommandInput>,
    forcePush?: boolean,
  ): Promise<string> {
    const contentType = options?.ContentType || 'image/jpg';
    const isPdf = this.isPdf(contentType);

    this.logger.log(`=== uploadFile called ===`);
    this.logger.log(`Content-Type: ${contentType}`);
    this.logger.log(`Options Key: ${options?.Key}`);
    this.logger.log(`Body size: ${body?.length} bytes`);
    this.logger.log(`forcePush: ${forcePush}`);

    let uploadParams: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: `${Date.now()}.jpg`,
      ACL: ObjectCannedACL.public_read,
      Body: body,
      ContentType: contentType,
      ...options,
    };

    // Handle PDF conversion for card images
    if (isPdf && uploadParams.Key.includes('cards-image')) {
      try {
        // Generate base filename without extension
        const filename = `pdf-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

        // Store original PDF
        const pdfKey = `${this.getPrefix()}uploads/cards-pdf/${filename}.pdf`;
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: pdfKey,
            Body: body,
            ContentType: 'application/pdf',
            ACL: ObjectCannedACL.public_read,
          }),
        );

        this.logger.log(`PDF saved at: ${this.s3Uri}/${pdfKey}`);

        // Convert PDF to PNG
        const pngBuffer = await this.convertPdfToImage(body);

        // Create new image path with PNG extension
        const pngKey = `${this.getPrefix()}uploads/cards-image/${filename}.png`;

        // Process PNG for card images (with lock overlay)
        if (!forcePush) {
          // Process like a regular image (create locked/unlocked versions)
          const imageUrl = await this.processCardImageBuffer(
            pngBuffer,
            `${filename}.png`,
            'image/png',
          );

          this.logger.log(`PDF converted and saved as PNG at: ${imageUrl}`);
          return imageUrl;
        } else {
          // Direct upload without processing
          uploadParams.Body = pngBuffer;
          uploadParams.ContentType = 'image/png';
          uploadParams.Key = pngKey;
        }
      } catch (error) {
        this.logger.error('Error handling PDF upload:', error);
        throw error;
      }
    }

    if (
      uploadParams.Key.startsWith(`${this.getPrefix()}uploads/cards-image`) &&
      !forcePush &&
      !isPdf
    ) {
      const imageName = uploadParams.Key.split('/').pop() || '';
      const mimeType = uploadParams.ContentType || 'image/jpg';

      return await this.processCardImageBuffer(body, imageName, mimeType);
    }

    const command = new PutObjectCommand(uploadParams);
    try {
      this.logger.log(`Uploading to S3: ${uploadParams.Key}`);
      await this.s3Client.send(command);
      this.logger.log(`Upload successful: ${uploadParams.Key}`);
      return `${this.s3Uri}/${uploadParams.Key}`;
    } catch (error) {
      this.logger.error(`S3 Upload failed for ${uploadParams.Key}:`, error);
      this.logger.error(`Error name: ${error.name}`);
      this.logger.error(`Error message: ${error.message}`);
      if (error.$metadata) {
        this.logger.error(`HTTP Status: ${error.$metadata.httpStatusCode}`);
      }
      throw error;
    }
  }

  public async getBufferFromUrl(
    url: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return {
        data: response.data,
        contentType: response.headers['content-type'],
      };
    } catch (e) {
      this.logger.error(e);
    }
  }

  private async loadLockImage(): Promise<Buffer> {
    const lockImagePath = path.resolve(process.cwd(), 'assets/icons/lock.png');
    return await fs.readFile(lockImagePath);
  }

  private async processCardImageBuffer(
    buffer: Buffer,
    imageName: string,
    mimetype: string,
  ) {
    // upload l'image qui est unlocked
    await this.uploadFile(
      buffer,
      {
        ContentType: mimetype,
        Key: `${this.getPrefix()}uploads/cards-image-unlocked/${imageName}`,
      },
      true,
    );

    const lockedImage = await this.processImage(buffer);

    return await this.uploadFile(
      lockedImage,
      {
        ContentType: mimetype,
        Key: `${this.getPrefix()}uploads/cards-image/${imageName}`,
      },
      true,
    );
  }

  async processImage(originalBuffer: Buffer): Promise<Buffer> {
    try {
      const image = sharp(originalBuffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image dimensions');
      }

      // Resize lock.png to be 20% of the image width
      const lockSize = Math.floor(metadata.width * 0.4);
      const lockImageBuffer = await this.loadLockImage();
      const resizedLock = await sharp(lockImageBuffer)
        .resize(lockSize, lockSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Ensure transparent background
        })
        .png() // Ensure the output is PNG
        .toBuffer();

      // Composite the lock.png over the image at the center
      const finalImage = await image
        .composite([
          {
            input: resizedLock,
            gravity: 'center',
          },
        ])
        .png() // Change to PNG to retain transparency
        .toBuffer();

      return finalImage;
    } catch (error) {
      throw error;
    }
  }
}
