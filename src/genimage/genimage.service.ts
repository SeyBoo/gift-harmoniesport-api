import { Injectable, Logger } from '@nestjs/common';
import { Jimp, JimpInstance, loadFont, measureText } from 'jimp';
import { UploadService } from '../common/upload/upload.service';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  CLUB_SIZE,
  VARIANT_GENERATOR_IMAGE,
} from './genimage.constant';
import { CardParams } from './genimage.interface';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import { jsPDF } from 'jspdf';

@Injectable()
export class GenimageService {
  private readonly logger = new Logger(GenimageService.name);
  constructor(
    private readonly uploadService: UploadService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private async createImage(width: number, height: number, color: string) {
    return new Jimp({ width, height, color });
  }
  private async readImage(imgPath: string) {
    try {
      if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
        // For URLs, fetch the image
        const response = await this.httpService.axiosRef.get(imgPath, {
          responseType: 'arraybuffer',
        });

        const contentType = response.headers['content-type'];
        const imageBuffer = response.data;

        // Try to detect WebP by checking file signature regardless of content-type
        const isWebp =
          this.isWebpBuffer(imageBuffer) || contentType?.includes('image/webp');

        if (isWebp) {
          this.logger.log(`Detected WebP image, converting to PNG: ${imgPath}`);
          try {
            // Dynamically import sharp only when needed
            const sharp = (await import('sharp')).default;
            const pngBuffer = await sharp(imageBuffer).png().toBuffer();

            return Jimp.read(pngBuffer);
          } catch (convError) {
            this.logger.error('Error converting WebP to PNG:', convError);
            throw new Error(
              `Failed to convert WebP image: ${convError.message}`,
            );
          }
        }

        try {
          // Try to read with Jimp directly
          return await Jimp.read(imageBuffer);
        } catch (jimpError) {
          // If Jimp fails and error mentions WebP, try to convert
          if (
            jimpError.message.includes('webp') ||
            jimpError.message.includes('Mime type')
          ) {
            this.logger.log(
              `Jimp failed, trying WebP conversion for: ${imgPath}`,
            );
            const sharp = (await import('sharp')).default;
            const pngBuffer = await sharp(imageBuffer).png().toBuffer();

            return Jimp.read(pngBuffer);
          }
          // If not WebP related, rethrow
          throw jimpError;
        }
      }

      // For local files
      const absoluteImgPath = path.resolve(process.cwd(), imgPath);
      return Jimp.read(absoluteImgPath);
    } catch (error) {
      this.logger.error(`Error reading image from ${imgPath}:`, error);
      throw new Error(`Failed to read image: ${error.message}`);
    }
  }

  // Helper method to detect WebP signature in buffer
  private isWebpBuffer(buffer: ArrayBuffer): boolean {
    if (!buffer || buffer.byteLength < 12) return false;

    const uint8Arr = new Uint8Array(buffer);
    // Check for RIFF header
    const hasRiffHeader =
      uint8Arr[0] === 82 && // R
      uint8Arr[1] === 73 && // I
      uint8Arr[2] === 70 && // F
      uint8Arr[3] === 70; // F

    // Check for WEBP signature at byte 8
    const hasWebpSignature =
      uint8Arr[8] === 87 && // W
      uint8Arr[9] === 69 && // E
      uint8Arr[10] === 66 && // B
      uint8Arr[11] === 80; // P

    return hasRiffHeader && hasWebpSignature;
  }

  private getFontUrl(fontPath: string): string {
    const absolutePath = path.resolve(process.cwd(), fontPath);
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    return normalizedPath;
  }

  private async getScaledFont(
    originalFontPath: string,
    size: 32 | 50 | 55 | 80 | 90 | 122 | 100,
  ): Promise<{
    fontPath: string;
    additionalRenderOptions?: any;
    scaleFactor?: number;
  }> {
    const pathParts = originalFontPath.split('/');
    const fontFileName = pathParts[pathParts.length - 2];
    const fontParts = fontFileName.split('-');

    const fontFamily = fontParts.slice(0, fontParts.length - 2).join('-');
    const fontColor = fontParts[fontParts.length - 1];

    let forcedSize = size;

    const newFontPath = `assets/fonts/${fontFamily}-${forcedSize}-${fontColor}/font.fnt`;

    const newFontUrl = this.getFontUrl(newFontPath);
    await loadFont(newFontUrl);

    return {
      fontPath: newFontPath,
    };
  }

  private async printString(
    src: JimpInstance,
    {
      name,
      fontPath,
      left,
      top,
      cardWidth,
      size,
    }: {
      name: string;
      fontPath: string;
      top: number;
      left?: number;
      cardWidth: number;
      size: 32 | 50 | 55 | 80 | 90 | 122 | 100;
    },
  ) {
    let fontSize = size;
    if (name.length >= 10) {
      fontSize = 90;
    } else if (name.length >= 8 && !name.includes(' ')) {
      fontSize = 100;
    }

    const { fontPath: scaledFontPath, additionalRenderOptions } =
      await this.getScaledFont(fontPath, fontSize);

    const scaledFontUrl = this.getFontUrl(scaledFontPath);
    const font = await loadFont(scaledFontUrl);

    const cleanedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const nameWidth = measureText(font, cleanedName);

    const x = left === undefined ? (cardWidth - nameWidth) / 2 : left;

    const printOptions = {
      font,
      x,
      y: top,
      text: Buffer.from(cleanedName, 'utf-8').toString(),
      ...additionalRenderOptions,
    };

    return src.print(printOptions);
  }

  private async enhanceImage(imageBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    try {
      const stabilityApiKey =
        this.configService.get<string>('STABILITY_API_KEY');
      if (!stabilityApiKey) {
        this.logger.warn(
          'STABILITY_API_KEY is not configured, skipping image enhancement',
        );
        return imageBuffer;
      }

      const formData = new FormData();
      formData.append(
        'image',
        new Blob([imageBuffer], { type: 'image/png' }),
        'image.png',
      );
      formData.append('output_format', 'png');

      const enhanceResponse = await this.httpService.axiosRef.post(
        'https://api.stability.ai/v2beta/stable-image/upscale/fast',
        formData,
        {
          headers: {
            Authorization: `Bearer ${stabilityApiKey}`,
            Accept: 'image/*',
          },
          responseType: 'arraybuffer',
        },
      );

      if (!enhanceResponse.data || enhanceResponse.status !== 200) {
        throw new Error(
          `Stability AI API error: ${enhanceResponse.status} ${enhanceResponse.statusText}`,
        );
      }

      return enhanceResponse.data;
    } catch (error) {
      this.logger.error('Error enhancing image:', error);
      if (error.response) {
        const errorData = error.response.headers['content-type']?.includes(
          'application/json',
        )
          ? JSON.parse(Buffer.from(error.response.data).toString('utf-8'))
          : error.response.data;
        this.logger.error('API Error Details:', errorData);
      }
      return imageBuffer;
    }
  }

  public async removeBackground(imageBuffer: ArrayBuffer) {
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('file', blob, 'image.png');

    const removeBgResponse = await this.httpService.axiosRef.post(
      'https://kconnv5tklt5utgs3vknc7h3aq0rloto.lambda-url.us-east-1.on.aws/remove-bg',
      formData,
      {
        responseType: 'arraybuffer',
      },
    );

    if (!removeBgResponse.data) {
      throw new Error(`Remove.bg API error: ${removeBgResponse.statusText}`);
    }

    return removeBgResponse.data;
  }

  private async removePlayerBackground(imageUrl: string) {
    try {
      const response = await this.httpService.axiosRef.get(imageUrl, {
        responseType: 'arraybuffer',
      });

      if (!response.data) {
        throw new Error(
          `Failed to fetch image from URL: ${response.statusText}`,
        );
      }

      // Check if the image is WebP using both content-type and file signature
      const contentType = response.headers['content-type'];
      let imageBuffer = response.data;

      const isWebp =
        this.isWebpBuffer(imageBuffer) || contentType?.includes('image/webp');

      if (isWebp) {
        this.logger.log(
          'Detected WebP image, converting to PNG before processing',
        );
        try {
          // Dynamically import sharp only when needed
          const sharp = (await import('sharp')).default;
          imageBuffer = await sharp(imageBuffer).png().toBuffer();
          this.logger.log('WebP successfully converted to PNG');
        } catch (convError) {
          this.logger.error('Error converting WebP to PNG:', convError);
          throw new Error(`Failed to convert WebP image: ${convError.message}`);
        }
      }

      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('file', blob, 'image.png');

      const removeBgResponse = await this.httpService.axiosRef.post(
        'https://kconnv5tklt5utgs3vknc7h3aq0rloto.lambda-url.us-east-1.on.aws/remove-bg',
        formData,
        {
          responseType: 'arraybuffer',
        },
      );

      if (!removeBgResponse.data) {
        throw new Error(`Remove.bg API error: ${removeBgResponse.statusText}`);
      }

      try {
        // Try to read with Jimp directly
        const image = await Jimp.read(removeBgResponse.data);
        if (!image || !image.bitmap) {
          throw new Error('Invalid image data received from Remove.bg API');
        }
        return { image };
      } catch (jimpError) {
        // If Jimp fails and error mentions WebP, try to convert
        if (
          jimpError.message.includes('webp') ||
          jimpError.message.includes('Mime type')
        ) {
          this.logger.log('Remove.bg returned WebP image, converting to PNG');
          const sharp = (await import('sharp')).default;
          const pngBuffer = await sharp(removeBgResponse.data).png().toBuffer();

          const image = await Jimp.read(pngBuffer);
          if (!image || !image.bitmap) {
            throw new Error('Invalid image data after WebP conversion');
          }
          return { image };
        }
        // If not WebP related, rethrow
        throw jimpError;
      }
    } catch (error) {
      this.logger.error('Error removing background:', error);
      if (error.response && error.response.data) {
        this.logger.error('Remove.bg API response error:', error.response.data);
      }
      return null;
    }
  }

  private async printLastName(
    image: JimpInstance,
    card: CardParams,
    scaleFactor: number,
  ) {
    if (card.name.type === 'two_lines') {
      const name = card.name.lastname.label.toUpperCase();
      const lastNameFontSize = 122;

      if (name.length > 12) {
        const words = name.split(' ');
        const midPoint = Math.ceil(words.length / 2);
        const firstHalf = words.slice(0, midPoint).join(' ');
        const secondHalf = words.slice(midPoint).join(' ');
        let fontSize = 122;

        if (name.length >= 10) {
          fontSize = 90;
        } else if (name.length >= 8 && !name.includes(' ')) {
          fontSize = 100;
        }

        await this.printString(image, {
          top: (405 + 20) * scaleFactor,
          fontPath: card.name.lastname.font,
          name: firstHalf,
          cardWidth: card.width * scaleFactor,
          size: 100,
        });

        await this.printString(image, {
          top: (465 + 20) * scaleFactor,
          fontPath: card.name.lastname.font,
          name: secondHalf,
          cardWidth: card.width * scaleFactor,
          size: 100,
        });

        return { spliced: true, fontSize };
      } else {
        let fontSize = 122;
        let baseTop = 465;
        if (name.length >= 10) {
          fontSize = 90;
          baseTop = 475;
        } else if (name.length >= 8 && !name.includes(' ')) {
          fontSize = 100;
          baseTop = 475;
        }

        await this.printString(image, {
          top: (baseTop + 20) * scaleFactor,
          fontPath: card.name.lastname.font,
          name: name,
          cardWidth: card.width * scaleFactor,
          size: lastNameFontSize,
        });

        return { spliced: false, fontSize };
      }
    }
  }

  private async generateImage(
    card: CardParams,
    removeBackground: boolean = true,
    playerZoomFactor: number = 1,
  ) {
    // Use higher resolution for better print quality (300 DPI)
    const scaleFactor = 4; // Increase to 4x for higher resolution
    const width = (card?.width || CARD_WIDTH) * scaleFactor;
    const height = (card?.height || CARD_HEIGHT) * scaleFactor;
    const backgroundColor = '#000000';

    const background = await this.readImage(card.background);
    background.resize({
      w: width,
      h: height,
    });

    const cover = await this.readImage(card.cover);
    cover.resize({
      w: width,
      h: height,
    });

    let playerImage;

    if (removeBackground) {
      const playerData = await this.removePlayerBackground(card.player.path);
      if (!playerData) {
        throw new Error(
          'Failed to process player image with background removal',
        );
      }
      playerImage = playerData.image;
    } else {
      playerImage = await this.readImage(card.player.path);
    }

    if (!playerImage) {
      throw new Error('Failed to process player image');
    }

    const maxPlayerHeight = height * (0.85 * playerZoomFactor);
    const maxPlayerWidth = width * (0.85 * playerZoomFactor);

    const resizedPlayer = playerImage.scaleToFit({
      w: maxPlayerWidth,
      h: maxPlayerHeight,
    });

    const playerX =
      (width - resizedPlayer.bitmap.width) / (2 * playerZoomFactor);
    const playerY =
      (height - resizedPlayer.bitmap.height) / (1 * playerZoomFactor);

    const club = await this.readImage(card.club.url);
    const resizedClub = await club.resize({
      w: 80 * scaleFactor,
      h: 80 * scaleFactor,
    });

    const image = await this.createImage(width, height, backgroundColor);

    image
      .blit({ src: background, x: 0, y: 0 } as any)
      .blit({ src: resizedPlayer, x: playerX, y: playerY } as any)
      .blit({ src: cover, x: 0, y: 0 } as any)
      .blit({
        src: resizedClub,
        x: card.club.left * scaleFactor,
        y: card.club.top * scaleFactor,
      } as any);

    if (card.name.type === 'two_lines') {
      const firstname = card.name.firstname;
      if (firstname.label) {
        const { spliced, fontSize } = await this.printLastName(
          image,
          card,
          scaleFactor,
        );
        console.log(fontSize);
        // Use a larger font for first name as well
        const firstnameFontSize = 50;
        const firstnameTop = spliced
          ? (355 + 30) * scaleFactor
          : fontSize === 100
            ? (430 + 30) * scaleFactor
            : fontSize === 90
              ? (420 + 30) * scaleFactor
              : (430 + 30) * scaleFactor;

        await this.printString(image, {
          top: firstnameTop,
          fontPath: card.name.firstname.font,
          name: card.name.firstname.label,
          left: (card.width * scaleFactor) / 6,
          cardWidth: card.width * scaleFactor,
          size: firstnameFontSize,
        });
      }
    } else if (card.name.type === 'one_line') {
      const top = (465 + 30) * scaleFactor;
      if (card.name.background) {
        const bar = await this.readImage(card.name.background);
        image.blit({ src: bar, x: 0, y: top });
      }
      if (card.name.name.label) {
        // Use a larger font for one-line name
        const oneLineFontSize = 80;
        await this.printString(image, {
          top: top + 12 * scaleFactor,
          left: 30 * scaleFactor,
          fontPath: card.name.name.font,
          name: card.name.name.label,
          cardWidth: card.width * scaleFactor,
          size: oneLineFontSize,
        });
      }
    }

    if (!!card.player.number) {
      /* await this.printString(image, {
        top: 425 * scaleFactor,
        left: (card.width - 65) * scaleFactor,
        cardWidth: card.width * scaleFactor,
        fontPath: card.player.number.font,
        name: `${card.player.number.value}`,
        size: 64, // or scale up if you have a larger font
      }); */
    }

    if (!!card.season.background) {
      const seasonBackground = await this.readImage(
        card.season.background.path,
      );
      seasonBackground.resize({
        w: seasonBackground.bitmap.width * scaleFactor,
        h: seasonBackground.bitmap.height * scaleFactor,
      });

      image.blit({
        src: seasonBackground,
        x:
          (card.season.background.left ||
            (CARD_WIDTH - seasonBackground.bitmap.width / scaleFactor) / 2) *
          scaleFactor,
        y: card.season.background.top * scaleFactor,
      });
    }

    if (card.season.label) {
      // Use a larger font for season label
      const seasonFontSize = 80;
      await this.printString(image, {
        top: card.season.top * scaleFactor,
        left: card.season.left ? card.season.left * scaleFactor : undefined,
        fontPath: card.season.font,
        name: card.season.label,
        cardWidth: width,
        size: seasonFontSize,
      });
    }

    return image;
  }

  private getCardParams(
    variant: VARIANT_GENERATOR_IMAGE,
    playerFaceUrl: string,
    playerLastname: string,
    playerFirstname: string,
    playerNumber: string | undefined,
    associationImageUri: string,
    season: string,
  ): CardParams {
    const baseParams = {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      club: {
        url: associationImageUri,
        top: 25,
        left: 30,
      },
      player: {
        path: playerFaceUrl,
      },
      name: {
        type: 'two_lines' as const,
        firstname: {
          label: playerFirstname,
          font: 'assets/fonts/birthstone-bounce-50-white/font.fnt',
        },
        lastname: {
          label: playerLastname,
          font: 'assets/fonts/barlow-condensed-122-white/font.fnt',
        },
      },
      season: {
        label: season,
        font: 'assets/fonts/barlow-condensed-28-white/font.fnt',
        top: CARD_HEIGHT - 10,
      },
    };

    const cardConfigs = {
      [VARIANT_GENERATOR_IMAGE.CARD001]: {
        ...baseParams,
        filename: 'card01.png',
        background: 'assets/backgrounds/background01.png',
        cover: 'assets/covers/cover01.png',
        club: {
          ...baseParams.club,
        },
        name: {
          type: 'two_lines' as const,
          firstname: {
            label: playerFirstname,
            font: 'assets/fonts/birthstone-bounce-50-white/font.fnt',
          },
          lastname: {
            label: playerLastname,
            font: 'assets/fonts/barlow-condensed-122-white/font.fnt',
          },
        },
        season: {
          label: season,
          font: 'assets/fonts/barlow-condensed-32-white/font.fnt',
          top: CARD_HEIGHT - 32,
        },
      },
      [VARIANT_GENERATOR_IMAGE.CARD002]: {
        ...baseParams,
        filename: 'card02.png',
        background: 'assets/backgrounds/background02.png',
        cover: 'assets/covers/cover02.png',
        club: {
          ...baseParams.club,
          left: 15,
        },
        name: {
          type: 'two_lines' as const,
          firstname: {
            label: playerFirstname,
            font: 'assets/fonts/birthstone-bounce-50-white/font.fnt',
          },
          lastname: {
            label: playerLastname,
            font: 'assets/fonts/barlow-condensed-122-white/font.fnt',
          },
        },
        season: {
          label: season,
          font: 'assets/fonts/barlow-condensed-28-white/font.fnt',
          top: CARD_HEIGHT - 60,
          background: {
            path: 'assets/seasons/background02.png',
            top: CARD_HEIGHT - 65,
          },
        },
      },
      [VARIANT_GENERATOR_IMAGE.CARD003]: {
        ...baseParams,
        filename: 'card03.png',
        background: 'assets/backgrounds/background03.png',
        cover: 'assets/covers/cover03.png',
        club: {
          ...baseParams.club,
          left: CARD_WIDTH - CLUB_SIZE - 15,
        },
        player: {
          ...baseParams.player,
          number: {
            font: 'assets/fonts/hatten-64-blue/font.fnt',
            value: playerNumber,
          },
        },
        name: {
          type: 'one_line' as const,
          background: 'assets/bar_titles/bar_title03.png',
          name: {
            label: `${playerFirstname} ${playerLastname}`,
            font: 'assets/fonts/hatten-32-white/font.fnt',
          },
        },
        season: {
          label: season,
          font: 'assets/fonts/barlow-condensed-24-white/font.fnt',
          top: CARD_HEIGHT - 100,
          left: CARD_WIDTH - 190,
          background: {
            path: 'assets/seasons/background03.png',
            top: CARD_HEIGHT - 105,
            left: CARD_WIDTH - 208,
          },
        },
      },
      [VARIANT_GENERATOR_IMAGE.CARD004]: {
        ...baseParams,
        filename: 'card04.png',
        background: 'assets/backgrounds/background04.png',
        cover: 'assets/covers/cover04.png',
      },
      [VARIANT_GENERATOR_IMAGE.CARD005]: {
        ...baseParams,
        filename: 'card05.png',
        background: 'assets/backgrounds/background05.png',
        cover: 'assets/covers/cover05.png',
      },
      [VARIANT_GENERATOR_IMAGE.CARD006]: {
        ...baseParams,
        filename: 'card06.png',
        background: 'assets/backgrounds/background06.png',
        cover: 'assets/covers/cover06.png',
      },
      [VARIANT_GENERATOR_IMAGE.CARD007]: {
        ...baseParams,
        filename: 'card07.png',
        background: 'assets/backgrounds/background07.png',
        cover: 'assets/covers/cover07.png',
      },
      [VARIANT_GENERATOR_IMAGE.CARD008]: {
        ...baseParams,
        filename: 'card08.png',
        background: 'assets/backgrounds/background08.png',
        cover: 'assets/covers/cover08.png',
      },
      [VARIANT_GENERATOR_IMAGE.CARD009]: {
        ...baseParams,
        filename: 'card09.png',
        background: 'assets/backgrounds/background09.png',
        cover: 'assets/covers/cover09.png',
      },
      [VARIANT_GENERATOR_IMAGE.CARD010]: {
        ...baseParams,
        filename: 'card10.png',
        background: 'assets/backgrounds/background10.png',
        cover: 'assets/covers/cover10.png',
      },
      [VARIANT_GENERATOR_IMAGE.CARD011]: {
        ...baseParams,
        filename: 'card11.png',
        background: 'assets/backgrounds/background11.png',
        cover: 'assets/covers/cover11.png',
      },
      [VARIANT_GENERATOR_IMAGE.CARD012]: {
        ...baseParams,
        filename: 'card12.png',
        background: 'assets/backgrounds/background12.png',
        cover: 'assets/covers/cover12.png',
      },
      [VARIANT_GENERATOR_IMAGE.CARD013]: {
        ...baseParams,
        filename: 'card13.png',
        background: 'assets/backgrounds/background13.png',
        cover: 'assets/covers/cover13.png',
      },
      [VARIANT_GENERATOR_IMAGE.CARD014]: {
        ...baseParams,
        filename: 'card14.png',
        background: 'assets/backgrounds/background14.png',
        cover: 'assets/covers/cover14.png',
      },
    };

    return cardConfigs[variant] || null;
  }

  private async convertToPdfWithJsPDF(imageBuffer: Buffer): Promise<Buffer> {
    try {
      this.logger.log('Using jsPDF to convert image to PDF');

      // Create a temporary file for the image
      const tempDir = os.tmpdir();
      const tempImagePath = path.join(tempDir, `image_${Date.now()}.png`);

      // Write the image buffer to a temporary file
      await fsPromises.writeFile(tempImagePath, imageBuffer);

      // Get image dimensions
      const image = await Jimp.read(imageBuffer);
      const width = image.bitmap.width;
      const height = image.bitmap.height;

      // Create a new PDF with proper dimensions (convert pixels to mm for jsPDF)
      // A4 is 210x297mm, but we'll use the image dimensions directly
      const pxToMm = 0.264583; // 1px = 0.264583mm
      const doc = new jsPDF({
        orientation: height > width ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [width * pxToMm, height * pxToMm],
      });

      // Convert the image to a base64 data URL
      const imageData = await fsPromises.readFile(tempImagePath);
      const base64Image = `data:image/png;base64,${imageData.toString('base64')}`;

      // Add the image to the PDF
      doc.addImage({
        imageData: base64Image,
        format: 'PNG',
        x: 0,
        y: 0,
        width: width * pxToMm,
        height: height * pxToMm,
        compression: 'NONE', // Better quality
      });

      // Get the PDF as a buffer
      const pdfOutput = doc.output('arraybuffer');

      // Clean up temporary file
      await fsPromises.unlink(tempImagePath).catch((err) => {
        this.logger.warn(`Failed to delete temp image: ${err.message}`);
      });

      return Buffer.from(pdfOutput);
    } catch (error) {
      this.logger.error(`Error creating PDF with jsPDF: ${error.message}`);
      if (error.stack) {
        this.logger.error(`Stack trace: ${error.stack}`);
      }
      throw error;
    }
  }

  public async generatePlayerCard(
    variant: VARIANT_GENERATOR_IMAGE,
    playerLastname: string,
    playerFirstname: string,
    playerNumber: string,
    associationImage: string,
    playerFaceUrl: string,
    season: string,
    format: 'png' | 'pdf' = 'png',
    removeBackground: boolean = true,
    playerZoomFactor: number = 1,
  ): Promise<string> {
    try {
      // Verify playerFaceUrl is a string and not empty
      if (!playerFaceUrl || typeof playerFaceUrl !== 'string') {
        throw new Error('Invalid player face URL provided');
      }

      this.logger.log(
        `Generating card for player ${playerFirstname} ${playerLastname} with image URL: ${playerFaceUrl}`,
      );

      const cardOptions = this.getCardParams(
        variant,
        playerFaceUrl,
        playerLastname,
        playerFirstname,
        playerNumber,
        associationImage,
        season,
      );

      const img = await this.generateImage(
        cardOptions,
        removeBackground,
        playerZoomFactor,
      );
      let dataImg = await img.getBuffer('image/png');

      const Key = `generated/${playerLastname}${playerFirstname}_${Date.now()}`;

      // Handle PDF conversion if requested
      if (format === 'pdf') {
        this.logger.log('Converting image to PDF format...');

        try {
          // Convert to PDF using jsPDF
          const pdfBuffer = await this.convertToPdfWithJsPDF(dataImg);

          const link = await this.uploadService.uploadFile(pdfBuffer, {
            ContentType: 'application/pdf',
            Key: `${Key}.pdf`,
          });

          return link;
        } catch (error) {
          this.logger.error(
            `PDF conversion failed: ${error.message}. Falling back to PNG with PDF extension.`,
          );

          // Last resort: PNG with PDF extension
          return await this.uploadService.uploadFile(dataImg, {
            ContentType: 'image/png',
            Key: `${Key}.pdf`,
          });
        }
      }

      return await this.uploadService.uploadFile(dataImg, {
        ContentType: 'image/png',
        Key: `${Key}.png`,
      });
    } catch (error) {
      // Improved error logging with specific checks for common issues
      if (error.message?.includes('WebP')) {
        this.logger.error(
          `WebP format error: ${error.message}. Please ensure WebP conversion is working properly.`,
          error.stack,
        );
      } else if (error.message?.includes('Mime type')) {
        this.logger.error(
          `Unsupported image format: ${error.message}. URL: ${playerFaceUrl}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Failed to generate player card: ${error.message}`,
          error.stack,
        );
      }

      return null;
    }
  }
}
