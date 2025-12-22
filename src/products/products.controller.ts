import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UseGuards,
  Headers,
  UploadedFiles,
  Query,
  Request,
  ForbiddenException,
  Put,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from './products.service';
import { CreateCardDto } from './dto/create-card.dto';
import { SendForRedesignDto } from './dto/send-for-redesign.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/decorators';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { User } from '../users/entities/user.entity';
import { Product } from './entities/product.entity';
import { Celebrity } from '../celebrities/entities/celebrity.entity';
import { AuthService } from '../auth/auth.service';
import { GenaiService } from '../genai/genai.service';
import {
  CreateBulkProductDto,
  GenerateAiCardDto,
  GenerateDynamicCardDto,
  PaginationDto,
} from '../common/dtos';
import { ThematicList } from '../thematics/entities/thematic.entity';
import { Pagination } from '../common/decorators';
import { GenimageService } from '../genimage/genimage.service';
import { UsersService } from '../users/users.service';
import { UploadService } from '../common/upload/upload.service';
import convert from 'heic-convert';
import { CoordinatesDto } from '../common/decorators/coordinates.decorator';
import { Coordinates } from '../common/decorators/coordinates.decorator';
import { Sponsor } from '../sponsors/entity/sponsors.entity';
import { SuggestCardDto } from './dto/suggest-description.dto';
import { LessThanOrEqual, MoreThanOrEqual, ILike } from 'typeorm';

@Controller('products')
export class ProductsController {
  private readonly TRENDS_THEMATIC_DISTRIBUTION = {
    [ThematicList.SPORT]: 0.3,
    [ThematicList.WOMEN]: 0.3,
    [ThematicList.CHILDREN]: 0.3,
    [ThematicList.ENVIRONMENT]: 0.1,
  };
  constructor(
    private readonly productsService: ProductsService,
    private readonly authService: AuthService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly genAiService: GenaiService,
    private readonly genImageService: GenimageService,
    private readonly userService: UsersService,
    private readonly uploadService: UploadService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Public()
  @Get('/check/slug')
  async checkSlug(@Query('slug') slug: string) {
    return { unique: !(await this.productsService.doesSlugExist(slug)) };
  }

  @Public()
  @Get('card/:id')
  findCard(@Param('id') id: string) {
    return this.productsService.findOne(+id, ['celebrity']);
  }

  @Patch('card/:id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'video_promo', maxCount: 1 },
      { name: 'video_thanks', maxCount: 1 },
      { name: 'image', maxCount: 1 },
      { name: 'collector_image', maxCount: 1 },
      { name: 'digital_image', maxCount: 1 },
      { name: 'magnet_image', maxCount: 1 },
    ]),
  )
  @UseGuards(JwtAuthGuard)
  async updateCard(
    @Param('id') id: string,
    @Body() updateCardDto: CreateCardDto,
    @UploadedFiles()
    files: {
      video_promo?: Express.Multer.File[];
      video_thanks?: Express.Multer.File[];
      image?: Express.Multer.File[];
      collector_image?: Express.Multer.File[];
      digital_image?: Express.Multer.File[];
      magnet_image?: Express.Multer.File[];
    },
  ) {
    return await this.productsService.updateCard(+id, updateCardDto, files);
  }

  @Delete('card/:id')
  @UseGuards(JwtAuthGuard)
  deleteCard(@Param('id') id: string) {
    return this.productsService.deleteCard(+id);
  }

  @Post('card')
  @UseInterceptors(
    FileFieldsInterceptor([
      {
        name: 'video_promo',
        maxCount: 1,
      },
      {
        name: 'video_thanks',
        maxCount: 1,
      },
      {
        name: 'image',
        maxCount: 1,
      },
      {
        name: 'collector_image',
        maxCount: 1,
      },
      
      {
        name: 'digital_image',
        maxCount: 1,
      },
      {
        name: 'magnet_image',
        maxCount: 1,
      },
    ]),
  )
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req,
    @Body() createCardDto: CreateCardDto,
    @UploadedFiles()
    files: {
      video_promo?: Express.Multer.File[];
      video_thanks?: Express.Multer.File[];
      image?: Express.Multer.File[];
      collector_image?: Express.Multer.File[];
      digital_image?: Express.Multer.File[];
      magnet_image?: Express.Multer.File[];
    },
  ) {
    return this.productsService.createCard(createCardDto, files);
  }

  @Post('card/bulk')
  @UseGuards(JwtAuthGuard)
  async createProductBulk(@Request() req, @Body() body: CreateBulkProductDto) {
    const uploadSession = await this.uploadService.getUploadSession({
      userId: req.user.id,
      id: body.uploadSessionId,
    });
    if (!uploadSession || !uploadSession.uploadItems.length) {
      throw new ForbiddenException(
        'Invalid upload session with empty elements',
      );
    }

    const campaign = await this.productsService.getCampaign({
      id: body.campaignId,
    });
    if (!campaign) {
      throw new ForbiddenException('Invalid campaign');
    }
    return await this.productsService.createBulkCardFromUploadSession(
      uploadSession.uploadItems,
      campaign,
      body.uploadSessionId,
    );
  }

  @Public()
  @Get('campaign/:id')
  findProductByCampaign(
    @Param('id') id: Campaign,
    @Pagination() pagination: PaginationDto,
  ) {
    return this.productsService.findProductByCampaign(id, pagination);
  }

  @Put('/upload')
  @UseInterceptors(
    FileFieldsInterceptor([
      {
        name: 'file',
        maxCount: 1,
      },
    ]),
  )
  async uploadCard(
    @UploadedFiles()
    files: {
      file: Express.Multer.File[];
    },
    @Body('path') customPath?: string,
  ): Promise<{ imageUrl: string }> {
    const { file } = files;

    if (!file || !file[0]) {
      throw new BadRequestException('A file is required for upload');
    }

    try {
      let fileBuffer = file[0].buffer;
      let fileType = file[0].mimetype.split('/')[1];

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
        Key: `${customPath || 'upload/player'}/${Date.now()}.${fileType}`,
      });

      return { imageUrl: uploadedFileUrl };
    } catch (error) {
      throw new BadRequestException(`File upload failed: ${error.message}`);
    }
  }

  @Put('/upload-player')
  @UseInterceptors(
    FileFieldsInterceptor([
      {
        name: 'file',
        maxCount: 1,
      },
    ]),
  )
  async uploadPlayerCard(
    @UploadedFiles()
    files: {
      file: Express.Multer.File[];
    },
    @Body('path') customPath?: string,
  ): Promise<{ imageUrl: string }> {
    const { file } = files;

    if (!file || !file[0]) {
      throw new BadRequestException('A file is required for upload');
    }

    try {
      let fileBuffer = file[0].buffer;
      let fileType = file[0].mimetype.split('/')[1];
      console.log(`[upload-player] File received: ${file[0].originalname}, type: ${file[0].mimetype}, size: ${file[0].size}`);

      if (fileType === 'heic') {
        console.log('[upload-player] Converting HEIC to JPEG...');
        const outputBuffer = await convert({
          buffer: fileBuffer,
          format: 'JPEG',
          quality: 1,
        });

        fileBuffer = outputBuffer;
        fileType = 'jpeg';
        console.log('[upload-player] HEIC conversion done');
      }

      console.log('[upload-player] Removing background...');
      const newBuffer = await this.genImageService.removeBackground(new Uint8Array(fileBuffer).buffer);
      console.log(`[upload-player] Background removed, new size: ${newBuffer?.length || 'null'}`);

      console.log('[upload-player] Uploading to S3...');
      // Always save as PNG after background removal (PNG supports transparency)
      const uploadedFileUrl = await this.uploadService.uploadFile(newBuffer, {
        ContentType: 'image/png',
        Key: `${customPath || 'upload/player'}/${Date.now()}.png`,
      });
      console.log(`[upload-player] Upload successful: ${uploadedFileUrl}`);

      return { imageUrl: uploadedFileUrl };
    } catch (error) {
      console.error('[upload-player] ERROR:', error);
      console.error('[upload-player] Error stack:', error.stack);
      throw new BadRequestException(`File upload failed: ${error.message}`);
    }
  }

  @Post('card/custom')
  @UseGuards(JwtAuthGuard)
  async getProductCustom(@Request() req, @Body() body: GenerateDynamicCardDto) {
    const user = await this.userService.findOne(req.user.id);

    if (!user.name_association || !user.logo) {
      throw new ForbiddenException(
        'Only association can generate card with an active logo',
      );
    }

    try {
      const logo = body.campaignId
        ? await this.getCampaignLogo(body.campaignId)
        : user.logo;

      const imageUrl = await this.genImageService.generatePlayerCard(
        body.variant,
        body.playerLastname,
        body.playerFirstname,
        body.playerNumber,
        logo,
        body.playerFaceUrl,
        body.seasonLabel,
        body.format,
        body.removeBackground,
        body.playerZoomFactor,
      );

      return { imageUrl };
    } catch (error) {
      console.error(`Error in getProductCustom: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async getCampaignLogo(campaignId: string): Promise<string> {
    const campaign = await this.productsService.getCampaign({
      id: +campaignId,
    });
    if (!campaign) {
      throw new ForbiddenException('Invalid campaign');
    }
    return campaign.customLogo;
  }

  @Get('suggest')
  async suggestCardDescription(@Query() dto: SuggestCardDto) {
    return await this.productsService.suggestCardDescription(
      dto.association,
      dto.campaign,
      dto.card,
    );
  }

  @Public()
  @Get()
  async findAll(
    @Pagination() pagination: PaginationDto,
    @Coordinates() coordinates: CoordinatesDto,
    @Query('subThematicIds') subThematicIds?: string,
    @Query('celebrityIds') celebrityIds?: string,
    @Query('associationIds') associationIds?: string,
    @Query('includeExpired') includeExpired?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const { lat, lng } = coordinates;
    const { page = 1, limit = 10, search, filter } = pagination;
    const offset = (page - 1) * limit;
    const shouldIncludeExpired = includeExpired === 'true';

    const subThematicIdsArray = subThematicIds?.split(',');
    const celebrityIdsArray = celebrityIds?.split(',');
    const associationIdsArray = associationIds?.split(',');

    // First fetch the products with standard filtering
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.celebrity', 'celebrity')
      .leftJoinAndSelect('product.campaign', 'campaign')
      .leftJoinAndSelect('campaign.user', 'user')
      .leftJoinAndSelect('user.thematic', 'thematic')
      .leftJoinAndSelect('user.subThematic', 'subThematic')
      .leftJoinAndSelect('product.userProducts', 'userProducts')
      .where('user.isActive = :isActive', { isActive: true })
      .andWhere('campaign.deleted = :deleted', { deleted: false });

    if (search) {
      queryBuilder.andWhere(
        '(product.name LIKE :search OR user.name_association LIKE :search OR celebrity.name LIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }

    if (celebrityIdsArray?.length) {
      queryBuilder.andWhere('celebrity.id IN (:...celebrityIdsArray)', {
        celebrityIdsArray,
      });
    }

    // Handle both thematics and sub-thematics in the filter
    if (filter?.length || subThematicIdsArray?.length) {
      const filterConditions: string[] = [];
      const filterParams: any = {};

      if (filter?.length) {
        filterConditions.push('thematic.id IN (:...thematicFilter)');
        filterParams.thematicFilter = filter;
      }

      if (subThematicIdsArray?.length) {
        filterConditions.push('subThematic.id IN (:...subThematicFilter)');
        filterParams.subThematicFilter = subThematicIdsArray;
      }

      // If filter contains IDs that could be sub-thematics, check both
      if (filter?.length) {
        filterConditions.push('subThematic.id IN (:...possibleSubThematicFilter)');
        filterParams.possibleSubThematicFilter = filter;
      }

      if (filterConditions.length > 0) {
        queryBuilder.andWhere(`(${filterConditions.join(' OR ')})`, filterParams);
      }
    }

    if (associationIdsArray?.length) {
      queryBuilder.andWhere('user.id IN (:...associationIdsArray)', {
        associationIdsArray,
      });
    }

    if (!shouldIncludeExpired) {
      queryBuilder.andWhere('campaign.date_end >= :currentDate', {
        currentDate: new Date(),
      });
    }

    // Get total count separately
    const countQuery = queryBuilder.clone();
    const count = await countQuery.getCount();

    // Apply sorting based on sortBy parameter
    const validSortOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    switch (sortBy) {
      case 'name':
        queryBuilder.orderBy('product.name', validSortOrder);
        break;
      case 'price':
        queryBuilder.orderBy('product.price', validSortOrder);
        break;
      case 'recent':
      default:
        queryBuilder.orderBy('product.createdAt', 'DESC');
        break;
    }

    queryBuilder
      .skip(offset)
      .take(limit);

    // Execute the query
    const items = await queryBuilder.getMany();

    // Calculate distances in JavaScript and sort
    function getDistance(lat1, lng1, lat2, lng2) {
      if (lat1 == null || lng1 == null || lat2 == null || lng2 == null)
        return Infinity;
      const toRad = (v) => (v * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const sortedItems = items
      .map((item) => ({
        ...item,
        hasCelebrity: !!item.celebrity,
        distance: getDistance(
          lat,
          lng,
          item.campaign?.user?.latitude,
          item.campaign?.user?.longitude,
        ),
      }))
      .sort((a, b) => {
        if (b.hasCelebrity !== a.hasCelebrity)
          return Number(b.hasCelebrity) - Number(a.hasCelebrity);
        return a.distance - b.distance;
      });

    const standardItems = sortedItems.map((item) => {
      return {
        ...item,
        id_association: item.campaign?.user?.id,
        name_association: item.campaign?.user?.name_association,
        logo_association: item.campaign?.user?.logo,
        slug_association: item.campaign?.user?.slug,
        thematic_id: item.campaign?.user?.thematic?.id,
        thematic_name: item.campaign?.user?.thematic?.name,
        campaign: {
          ...item.campaign,
          date_end: item.campaign?.date_end,
          user: {},
        },
      };
    });

    return {
      items: standardItems,
      total: Math.ceil(count / limit),
      page,
      limit,
    };
  }

  @Public()
  @Get('tendance')
  async findAllTendance(
    @Pagination() pagination: PaginationDto,
    @Coordinates() coordinates: CoordinatesDto,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const { lat, lng } = coordinates;
    const totalLimit = pagination.limit;
    const shouldIncludeExpired = includeExpired === 'true';

    // Calculate limits for each thematic, ensuring we don't lose products due to rounding
    const thematicEntries = Object.entries(this.TRENDS_THEMATIC_DISTRIBUTION);
    const thematicLimits = new Map<string, number>();
    let allocatedProducts = 0;

    // Allocate products to each thematic based on percentages
    for (let i = 0; i < thematicEntries.length; i++) {
      const [thematicName, percentage] = thematicEntries[i];
      const isLast = i === thematicEntries.length - 1;
      
      if (isLast) {
        // Give remaining products to the last thematic to avoid losing any due to rounding
        thematicLimits.set(thematicName, totalLimit - allocatedProducts);
      } else {
        const limit = Math.floor(totalLimit * percentage);
        thematicLimits.set(thematicName, limit);
        allocatedProducts += limit;
      }
    }

    const thematicPromises = Array.from(thematicLimits.entries()).map(
      async ([thematicName, thematicLimit]) => {
        const query = this.productRepository
          .createQueryBuilder('product')
          .leftJoinAndSelect('product.campaign', 'campaign')
          .leftJoinAndSelect('campaign.user', 'user')
          .leftJoinAndSelect('user.thematic', 'thematic')
          .leftJoinAndSelect('product.celebrity', 'celebrity')
          .select([
            'product.price as price',
            'product.id as id',
            'product.name as name',
            'product.slug as slug',
            'product.image as image',
            'user.id as id_association',
            'name_association',
            'user.logo as logo_association',
            'user.slug as slug_association',
            'thematic.id as thematic_id',
            'thematic.name as thematic_name',
            'date_start',
            'date_end',
            'celebrity.name as celebrity_name',
            'celebrity.imageUrl as celebrity_image',
            'celebrity.id as celebrity_slug',
            'celebrity.jobTitle as celebrity_job',
            `(6371 * acos(
              cos(radians(${lat})) * cos(radians(user.latitude)) * cos(radians(user.longitude) - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(user.latitude))
            )) AS distance`,
          ])
          .where('thematic.name = :name', { name: thematicName })
          .andWhere('user.is_active is true')
          .andWhere('campaign.deleted is false');

        if (!shouldIncludeExpired) {
          query.andWhere(
            'CURRENT_DATE BETWEEN campaign.date_start AND campaign.date_end',
          );
        }

        query
          .limit(thematicLimit)
          .orderBy('product.createdAt', 'DESC')
          .addOrderBy('user.latitude IS NULL OR user.longitude IS NULL', 'ASC')
          .addOrderBy('distance');

        return await query.getRawMany();
      },
    );

    const results = await Promise.all(thematicPromises);
    const allProducts = results.flat();

    // If we still don't have enough products, fill the gap with any available products
    if (allProducts.length < totalLimit) {
      const existingIds = allProducts.map(p => p.id);
      const remainingLimit = totalLimit - allProducts.length;

      const fillQuery = this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.campaign', 'campaign')
        .leftJoinAndSelect('campaign.user', 'user')
        .leftJoinAndSelect('user.thematic', 'thematic')
        .leftJoinAndSelect('product.celebrity', 'celebrity')
        .select([
          'product.price as price',
          'product.id as id',
          'product.name as name',
          'product.slug as slug',
          'product.image as image',
          'user.id as id_association',
          'name_association',
          'user.logo as logo_association',
          'user.slug as slug_association',
          'thematic.id as thematic_id',
          'thematic.name as thematic_name',
          'date_start',
          'date_end',
          'celebrity.name as celebrity_name',
          'celebrity.imageUrl as celebrity_image',
          'celebrity.id as celebrity_slug',
          'celebrity.jobTitle as celebrity_job',
          `(6371 * acos(
            cos(radians(${lat})) * cos(radians(user.latitude)) * cos(radians(user.longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(user.latitude))
          )) AS distance`,
        ])
        .where('user.is_active is true')
        .andWhere('campaign.deleted is false');

      if (existingIds.length > 0) {
        fillQuery.andWhere('product.id NOT IN (:...existingIds)', { existingIds });
      }

      if (!shouldIncludeExpired) {
        fillQuery.andWhere(
          'CURRENT_DATE BETWEEN campaign.date_start AND campaign.date_end',
        );
      }

      fillQuery
        .limit(remainingLimit)
        .orderBy('product.createdAt', 'DESC')
        .addOrderBy('user.latitude IS NULL OR user.longitude IS NULL', 'ASC')
        .addOrderBy('distance');

      const fillProducts = await fillQuery.getRawMany();
      allProducts.push(...fillProducts);
    }

    return allProducts.slice(0, totalLimit);
  }

  @Public()
  @Get('sports-clubs')
  async findSportsClubCards(
    @Coordinates() coordinates: CoordinatesDto,
    @Query('limit') limit: string = '20',
    @Query('includeExpired') includeExpired?: string,
  ) {
    const { lat, lng } = coordinates;
    const limitNum = Number(limit);
    const shouldIncludeExpired = includeExpired === 'true';

    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.campaign', 'campaign')
      .leftJoinAndSelect('campaign.user', 'user')
      .leftJoinAndSelect('user.thematic', 'thematic')
      .leftJoinAndSelect('user.subThematic', 'subThematic')
      .leftJoinAndSelect('product.celebrity', 'celebrity')
      .select([
        'product.price as price',
        'product.id as id',
        'product.name as name',
        'product.slug as slug',
        'product.image as image',
        'user.id as id_association',
        'name_association',
        'user.logo as logo_association',
        'user.slug as slug_association',
        'thematic.id as thematic_id',
        'thematic.name as thematic_name',
        'date_start',
        'date_end',
        'celebrity.name as celebrity_name',
        'celebrity.imageUrl as celebrity_image',
        'celebrity.id as celebrity_slug',
        'celebrity.jobTitle as celebrity_job',
        `(6371 * acos(
          cos(radians(${lat})) * cos(radians(user.latitude)) * cos(radians(user.longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(user.latitude))
        )) AS distance`,
      ])
      .where('thematic.name = :thematicName', { thematicName: ThematicList.SPORT })
      .andWhere('user.is_active is true')
      .andWhere('campaign.deleted is false');

    if (!shouldIncludeExpired) {
      query.andWhere(
        'CURRENT_DATE BETWEEN campaign.date_start AND campaign.date_end',
      );
    }

    query
      .limit(limitNum)
      .orderBy('product.createdAt', 'DESC')
      .addOrderBy('user.latitude IS NULL OR user.longitude IS NULL', 'ASC')
      .addOrderBy('distance');

    return await query.getRawMany();
  }

  @Public()
  @Get('nearby')
  async findNearbyCards(
    @Coordinates() coordinates: CoordinatesDto,
    @Query('limit') limit: string = '20',
    @Query('maxDistance') maxDistance: string = '100',
    @Query('includeExpired') includeExpired?: string,
  ) {
    const { lat, lng } = coordinates;
    const limitNum = Number(limit);
    const maxDistanceNum = Number(maxDistance);
    const shouldIncludeExpired = includeExpired === 'true';

    if (!lat || !lng) {
      return [];
    }

    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.campaign', 'campaign')
      .leftJoinAndSelect('campaign.user', 'user')
      .leftJoinAndSelect('user.thematic', 'thematic')
      .leftJoinAndSelect('product.celebrity', 'celebrity')
      .select([
        'product.price as price',
        'product.id as id',
        'product.name as name',
        'product.slug as slug',
        'product.image as image',
        'user.id as id_association',
        'name_association',
        'user.logo as logo_association',
        'user.slug as slug_association',
        'thematic.id as thematic_id',
        'thematic.name as thematic_name',
        'date_start',
        'date_end',
        'celebrity.name as celebrity_name',
        'celebrity.imageUrl as celebrity_image',
        'celebrity.id as celebrity_slug',
        'celebrity.jobTitle as celebrity_job',
        `(6371 * acos(
          cos(radians(${lat})) * cos(radians(user.latitude)) * cos(radians(user.longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(user.latitude))
        )) AS distance`,
      ])
      .where('user.is_active is true')
      .andWhere('campaign.deleted is false')
      .andWhere('user.latitude IS NOT NULL')
      .andWhere('user.longitude IS NOT NULL')
      .having(`distance <= :maxDistance`, { maxDistance: maxDistanceNum });

    if (!shouldIncludeExpired) {
      query.andWhere(
        'CURRENT_DATE BETWEEN campaign.date_start AND campaign.date_end',
      );
    }

    query
      .limit(limitNum)
      .orderBy('distance', 'ASC')
      .addOrderBy('product.createdAt', 'DESC');

    return await query.getRawMany();
  }

  @Public()
  @Get('celebrity')
  async findAllCelebrity(
    @Pagination() pagination: PaginationDto,
    @Coordinates() coordinates: CoordinatesDto,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const { lat, lng } = coordinates;
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;
    const shouldIncludeExpired = includeExpired === 'true';

    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.campaign', 'campaign')
      .leftJoinAndSelect('campaign.user', 'user')
      .leftJoinAndSelect('user.thematic', 'thematic')
      .innerJoinAndSelect('product.celebrity', 'celebrity')
      .select([
        'product.price as price',
        'product.id as id',
        'product.name as name',
        'product.slug as slug',
        'product.image as image',
        'user.id as id_association',
        'name_association',
        'date_start',
        'date_end',
        'celebrity.name as celebrity_name',
        'celebrity.imageUrl as celebrity_image',
        'celebrity.id as celebrity_slug',
        'celebrity.jobTitle as celebrity_job',
        `(6371 * acos(
          cos(radians(${lat})) * cos(radians(user.latitude)) * cos(radians(user.longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(user.latitude))
        )) AS distance`,
      ])
      .where('user.is_active is true')
      .andWhere('celebrity.id IS NOT NULL')
      .andWhere('campaign.deleted is false')
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('MIN(p.id)')
          .from('product', 'p')
          .innerJoin('p.celebrity', 'c')
          .where('p.celebrity_id = celebrity.id')
          .getQuery();
        return 'product.id IN ' + subQuery;
      });

    if (!shouldIncludeExpired) {
      query.andWhere(
        'CURRENT_DATE BETWEEN campaign.date_start AND campaign.date_end',
      );
    }

    const countQuery = this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.campaign', 'campaign')
      .leftJoin('campaign.user', 'user')
      .innerJoin('product.celebrity', 'celebrity')
      .select('COUNT(DISTINCT celebrity.id)', 'count')
      .where('user.is_active is true')
      .andWhere('celebrity.id IS NOT NULL')
      .andWhere('campaign.deleted is false');

    if (!shouldIncludeExpired) {
      countQuery.andWhere(
        'CURRENT_DATE BETWEEN campaign.date_start AND campaign.date_end',
      );
    }

    const [items, total] = await Promise.all([
      query.orderBy('product.createdAt', 'DESC').addOrderBy('distance', 'ASC').offset(offset).limit(limit).getRawMany(),
      countQuery.getRawOne(),
    ]);

    return {
      items,
      total: parseInt(total.count, 10) || 0,
      page,
      limit,
    };
  }

  @Public()
  @Get('mydons')
  async findMyDons(@Headers('authorization') userHeader: string) {
    const token = userHeader.split(' ')[1];
    const profile = this.authService.getProfile(token);

    if (profile) {
      const a = await this.productsService.findMyDons(+profile.sub);
      return a;
    }
  }
  @Public()
  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const shouldIncludeExpired = includeExpired === 'true';
    const offset = (page - 1) * limit;
    const now = new Date();

    const cardsQuery = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.campaign', 'campaign')
      .leftJoinAndSelect('campaign.user', 'user')
      .leftJoinAndSelect('product.celebrity', 'celebrity')
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.image',
        'product.price',
        'campaign.id',
        'campaign.date_start',
        'campaign.date_end',
        'user.id',
        'user.name_association',
        'user.slug',
        'celebrity.id',
        'celebrity.name',
        'celebrity.imageUrl',
      ])
      .where(
        '(LOWER(product.name) LIKE :query OR LOWER(product.multilingual_message_donation) LIKE :query)',
        { query: `%${query.toLowerCase()}%` },
      )
      .andWhere('user.isActive = :isActive', { isActive: true })
      .andWhere('campaign.deleted = :deleted', { deleted: false });

    if (!shouldIncludeExpired) {
      cardsQuery.andWhere('campaign.date_end >= :now', { now });
    }

    const celebritiesQuery = this.productRepository
      .createQueryBuilder('product')
      .innerJoinAndSelect('product.celebrity', 'celebrity')
      .leftJoinAndSelect('product.campaign', 'campaign')
      .leftJoinAndSelect('campaign.user', 'user')
      .select([
        'celebrity.id',
        'celebrity.name',
        'celebrity.imageUrl',
        'celebrity.jobTitle',
        'product.id',
      ])
      .distinct(true)
      .where('LOWER(celebrity.name) LIKE :query', {
        query: `%${query.toLowerCase()}%`,
      })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .andWhere('campaign.deleted = :deleted', { deleted: false });

    if (!shouldIncludeExpired) {
      celebritiesQuery.andWhere('campaign.date_end >= :now', { now });
    }

    const associationsQuery = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.thematic', 'thematic')
      .select([
        'user.id',
        'user.name_association',
        'user.slug',
        'user.logo',
        'thematic.id',
        'thematic.name',
      ])
      .where('LOWER(user.name_association) LIKE :query', {
        query: `%${query.toLowerCase()}%`,
      })
      .andWhere('user.isActive = :isActive', { isActive: true });

    const [cardsCount, celebritiesCount, associationsCount] = await Promise.all(
      [
        cardsQuery.getCount(),
        celebritiesQuery.getCount(),
        associationsQuery.getCount(),
      ],
    );

    const [cards, celebrities, associations] = await Promise.all([
      cardsQuery.skip(offset).take(limit).getMany(),
      celebritiesQuery.skip(offset).take(limit).getMany(),
      associationsQuery.skip(offset).take(limit).getMany(),
    ]);

    const uniqueCelebrities = celebrities.reduce((acc, product) => {
      const celebrity = product.celebrity;
      if (!acc.some((c) => c.id === celebrity.id)) {
        acc.push({
          id: celebrity.id,
          name: celebrity.name,
          imageUrl: celebrity.imageUrl,
          jobTitle: celebrity.jobTitle,
        });
      }
      return acc;
    }, []);

    const processedCards = cards.map((card) => ({
      id: card.id,
      name: card.name,
      slug: card.slug,
      image: card.image,
      price: card.price,
      campaign: {
        id: card.campaign?.id,
        date_start: card.campaign?.date_start,
        date_end: card.campaign?.date_end,
      },
      association: {
        id: card.campaign?.user?.id,
        name: card.campaign?.user?.name_association,
        slug: card.campaign?.user?.slug,
      },
      celebrity: card.celebrity
        ? {
            id: card.celebrity.id,
            name: card.celebrity.name,
            imageUrl: card.celebrity.imageUrl,
          }
        : null,
    }));

    const processedAssociations = associations.map((association) => ({
      id: association.id,
      name: association.name_association,
      slug: association.slug,
      logo: association.logo,
      thematic: association.thematic
        ? {
            id: association.thematic.id,
            name: association.thematic.name,
          }
        : null,
    }));

    return {
      cards: {
        items: processedCards,
        total: cardsCount,
        page,
        limit,
        pages: Math.ceil(cardsCount / limit),
      },
      celebrities: {
        items: uniqueCelebrities,
        total: celebritiesCount,
        page,
        limit,
        pages: Math.ceil(celebritiesCount / limit),
      },
      associations: {
        items: processedAssociations,
        total: associationsCount,
        page,
        limit,
        pages: Math.ceil(associationsCount / limit),
      },
    };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const productData = await this.productRepository
      .createQueryBuilder('p')
      .innerJoin(Campaign, 'c', 'p.campaign_id = c.id')
      .leftJoin(Celebrity, 'ce', 'p.celebrity_id = ce.id')
      .innerJoin(User, 'u', 'c.user_id = u.id')
      .leftJoin(Sponsor, 's', 'u.id = s.user_id')
      .select([
        'p.*',
        'u.id as id_association',
        'ce.id as celebrity_id',
        'ce.name as celebrity_name',
        'ce.imageUrl as celebrity_image',
        'ce.id as celebrity_slug',
        'ce.jobTitle as celebrity_title',
        'ce.description as celebrity_description',
        'u.name_association as name_association',
        'u.logo as logo_association',
        'u.slug as slug_association',
        'u.fond_usage_description as association_fund_usage',
        'c.date_start',
        'c.date_end',
        's.id as sponsor_id',
        's.name as sponsor_name',
        's.logo as sponsor_logo',
        's.link as sponsor_link',
        's.height as sponsor_height',
        's.width as sponsor_width',
      ])
      .where('p.id = :id OR p.slug = :id', { id })
      .groupBy('p.id, s.id')
      .getRawMany();

    const sponsorsMap = productData.reduce((acc, product) => {
      if (!acc[product.id]) {
        acc[product.id] = [];
      }
      acc[product.id].push({
        id: product.sponsor_id,
        name: product.sponsor_name,
        logo: product.sponsor_logo,
        link: product.sponsor_link,
        height: product.sponsor_height,
        width: product.sponsor_width,
      });
      return acc;
    }, {});

    return productData.map((product) => ({
      ...product,
      celebrity_description: product.celebrity_description,
      association_fund_usage: product.association_fund_usage,
      sponsors: sponsorsMap[product.id] || [],
    }));
  }

  @Public()
  @Get('bycampaign/:id')
  findProductsByCampaign(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('exceptIds') exceptIds?: string,
  ) {
    const query = this.productRepository
      .createQueryBuilder('p')
      .innerJoin('p.campaign', 'c')
      .select(['p.*', 'c.date_start as startDate', 'c.date_end as endDate'])
      .where('p.campaign_id = :id', { id });

    if (exceptIds) {
      const exceptIdsArray = exceptIds.split(',').map((id) => id.trim());
      query.andWhere('p.id NOT IN (:...exceptIds)', {
        exceptIds: exceptIdsArray,
      });
    }

    if (limit) {
      query.limit(Number(limit));
    }

    return query.getRawMany();
  }

  @Public()
  @Get('recommendations/:campaignId')
  async findRecommendations(
    @Param('campaignId') campaignId: string,
    @Coordinates() coordinates: CoordinatesDto,
    @Query('limit') limit: string = '10',
    @Query('exceptIds') exceptIds?: string,
  ) {
    const { lat, lng } = coordinates;
    const limitNum = Number(limit);

    // Get the source campaign details - start from campaign repository
    const sourceCampaign = await this.productRepository.manager
      .createQueryBuilder()
      .select([
        'c.id',
        'u.latitude',
        'u.longitude', 
        't.id as thematic_id',
        'st.id as sub_thematic_id',
      ])
      .from('campaign', 'c')
      .innerJoin('user', 'u', 'c.user_id = u.id')
      .leftJoin('thematic', 't', 'u.thematic_id = t.id')
      .leftJoin('sub_thematic', 'st', 'u.sub_thematic_id = st.id')
      .where('c.id = :campaignId', { campaignId })
      .getRawOne();

    if (!sourceCampaign) {
      throw new NotFoundException('Campaign not found');
    }

    const query = this.productRepository
      .createQueryBuilder('p')
      .innerJoin('p.campaign', 'c')
      .innerJoin('c.user', 'u')
      .leftJoin('u.thematic', 't')
      .leftJoin('u.subThematic', 'st')
      .leftJoin('p.celebrity', 'ce')
      .select([
        'p.id as product_id',
        'p.name as product_name', 
        'p.slug as product_slug',
        'p.image as product_image',
        'p.price as product_price',
        'c.id as campaign_id',
        'c.date_start',
        'c.date_end',
        'u.id as association_id',
        'u.name_association',
        'u.logo as association_logo',
        'ce.id as celebrity_id',
        'ce.name as celebrity_name',
        'ce.imageUrl as celebrity_image',
        // Calculate distance if coordinates are available
        sourceCampaign.latitude && sourceCampaign.longitude && lat && lng
          ? `(6371 * acos(
              cos(radians(${lat})) * cos(radians(u.latitude)) * cos(radians(u.longitude) - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(u.latitude))
            )) AS distance`
          : '0 AS distance',
        // Add similarity score based on thematic match
        `CASE 
          WHEN t.id = :thematicId AND st.id = :subThematicId THEN 3
          WHEN t.id = :thematicId THEN 2
          WHEN st.id = :subThematicId THEN 1
          ELSE 0
        END AS similarity_score`,
      ])
      .where('c.id != :campaignId', { campaignId })
      .andWhere('u.isActive = :isActive', { isActive: true })
      .andWhere('c.deleted = :deleted', { deleted: false })
      .andWhere('c.date_end >= :currentDate', { currentDate: new Date() })
      .setParameter('thematicId', sourceCampaign.thematic_id)
      .setParameter('subThematicId', sourceCampaign.sub_thematic_id);

    if (exceptIds) {
      const exceptIdsArray = exceptIds.split(',').map((id) => id.trim());
      query.andWhere('p.slug NOT IN (:...exceptIds) AND p.id NOT IN (:...exceptIds)', {
        exceptIds: exceptIdsArray,
      });
    }

    // Order by similarity score first, then by distance, then by celebrity presence
    query
      .orderBy('similarity_score', 'DESC')
      .addOrderBy('distance', 'ASC')
      .addOrderBy('CASE WHEN ce.id IS NOT NULL THEN 0 ELSE 1 END', 'ASC')
      .limit(limitNum);

    const recommendations = await query.getRawMany();

    return {
      source_campaign_id: campaignId,
      source_campaign_details: sourceCampaign,
      recommendations: recommendations.map((rec) => ({
        id: rec.product_id,
        name: rec.product_name,
        slug: rec.product_slug,
        image: rec.product_image,
        price: rec.product_price,
        campaign: {
          id: rec.campaign_id,
          date_start: rec.date_start,
          date_end: rec.date_end,
        },
        association: {
          id: rec.association_id,
          name: rec.name_association,
          logo: rec.association_logo,
        },
        celebrity: rec.celebrity_id
          ? {
              id: rec.celebrity_id,
              name: rec.celebrity_name,
              image: rec.celebrity_image,
            }
          : null,
        similarity_score: rec.similarity_score,
        distance: parseFloat(rec.distance) || 0,
      })),
      total: recommendations.length,
    };
  }

  @Public()
  @Get('byassociation-available/:id')
  async findAllByAssociationAvailable(
    @Param('id') id: string,
    @Pagination() pagination: PaginationDto,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const user = await this.userRepository.findOne({
      where: [
        { id: isNaN(Number(id)) ? undefined : Number(id) },
        { slug: id },
      ].filter((condition) => Object.values(condition)[0] !== undefined),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { page = 1, limit = 10, search } = pagination;
    const offset = (page - 1) * limit;
    const shouldIncludeExpired = includeExpired === 'true';

    const whereCondition: any = {
      campaign: {
        user: { id: user.id },
      },
    };

    if (!shouldIncludeExpired) {
      const now = new Date();
      whereCondition.campaign = {
        ...whereCondition.campaign,
        date_start: LessThanOrEqual(now),
        date_end: MoreThanOrEqual(now),
      };
    }

    if (search) {
      whereCondition.name = ILike(`%${search.toLowerCase()}%`);
    }

    const [products, total] = await this.productRepository.findAndCount({
      where: whereCondition,
      relations: [
        'celebrity',
        'campaign',
        'campaign.user',
        'campaign.user.thematic',
        'campaign.user.subThematic',
      ],
      skip: offset,
      take: limit,
      order: { id: 'DESC' },
    });

    const items = products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      slug: product.slug,
      image: product.image,
      imageUrl: product.imageUrl,
      id_association: product.campaign.user.id,
      name_association: product.campaign.user.name_association,
      thematic_id: product.campaign.user.thematic?.id,
      is_active: product.campaign.user.isActive ? 1 : 0,
      campaign_deleted: product.campaign.deleted ? 1 : 0,
      sub_thematic_id: product.campaign.user.subThematic?.id,
      date_start: product.campaign.date_start,
      date_end: product.campaign.date_end,
      celebrity_name: product.celebrity?.name,
      celebrity_image: product.celebrity?.imageUrl,
      celebrity_slug: product.celebrity?.id,
      celebrity_title: product.celebrity?.jobTitle,
    }));

    return {
      items,
      total,
      page,
      limit,
    };
  }

  @Public()
  @Get('byassociation-unavailable/:id')
  async findAllByAssociationUnavailable(
    @Param('id') id: string,
    @Pagination() pagination: PaginationDto,
  ) {
    const user = await this.userRepository.findOne({
      where: [
        { id: isNaN(Number(id)) ? undefined : Number(id) },
        { slug: id },
      ].filter((condition) => Object.values(condition)[0] !== undefined),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { page = 1, limit = 10, search } = pagination;
    const offset = (page - 1) * limit;

    const whereCondition: any = {
      campaign: {
        user: { id: user.id },
      },
    };

    const now = new Date();

    whereCondition.campaign = {
      ...whereCondition.campaign,
      date_end: LessThanOrEqual(now),
    };

    if (search) {
      whereCondition.name = ILike(`%${search.toLowerCase()}%`);
    }

    const [products, total] = await this.productRepository.findAndCount({
      where: whereCondition,
      relations: [
        'celebrity',
        'campaign',
        'campaign.user',
        'campaign.user.thematic',
        'campaign.user.subThematic',
      ],
      skip: offset,
      take: limit,
      order: { id: 'DESC' },
    });

    const items = products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      slug: product.slug,
      image: product.image,
      imageUrl: product.imageUrl,
      id_association: product.campaign.user.id,
      name_association: product.campaign.user.name_association,
      thematic_id: product.campaign.user.thematic?.id,
      is_active: product.campaign.user.isActive ? 1 : 0,
      campaign_deleted: product.campaign.deleted ? 1 : 0,
      sub_thematic_id: product.campaign.user.subThematic?.id,
      date_start: product.campaign.date_start,
      endDate: product.campaign.date_end,
      celebrity_name: product.celebrity?.name,
      celebrity_image: product.celebrity?.imageUrl,
      celebrity_slug: product.celebrity?.id,
      celebrity_title: product.celebrity?.jobTitle,
    }));

    return {
      items,
      total,
      page,
      limit,
    };
  }

  @Public()
  @Get('byassociation/:id')
  findAllByAssociation(@Param('id') id: string) {
    return this.productRepository
      .createQueryBuilder('p')
      .innerJoin(Campaign, 'c', 'p.campaign_id = c.id')
      .leftJoin(Celebrity, 'ce', 'p.celebrity_id = ce.id')
      .innerJoin(User, 'u', 'c.user_id = u.id')
      .select([
        'p.*',
        'u.id as id_association',
        'ce.name',
        'name_association',
        'date_start',
        'date_end',
      ])
      .where('u.id = :id OR u.slug = :id', { id })
      .getRawMany();
  }

  @UseGuards(JwtAuthGuard)
  @Post('card/generate')
  async generateAiCard(@Request() req, @Body() body: GenerateAiCardDto) {
    const userId = req?.user?.id;
    const remainingCredit =
      await this.productsService.countAiRemainingCredit(userId);

    if (remainingCredit <= 0) {
      throw new ForbiddenException('Maximum quota exceeded. Please wait');
    }

    const { progress, status, url, id } = await this.genAiService.generateCard(
      `Générer moi une carte pour promuvoir une association à but caritatif, l'image est de type ${body.imageType} avec le prompt suivant ${body.prompt}`,
    );
    const aiGenerated = await this.productsService.createAiGeneration({
      userId: req?.user?.id,
      imageType: body.imageType,
      prompt: body.prompt,
      progress: progress ?? 0,
      status,
      webhookId: id,
      imageUrl: url ?? '',
    });
    return {
      success: true,
      data: aiGenerated,
      remainingCredit: remainingCredit - 1,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('card/generate/:id')
  async selectGeneratedCard(
    @Param('id') id: string,
    @Body() body: { url: string },
    @Request() req,
  ) {
    const url = body.url;

    const aiGenerated = await this.productsService.selectAiGeneration(
      req.user.id,
      parseInt(id),
      url,
    );

    return {
      success: true,
      data: aiGenerated,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('card/generate/:id')
  async getGenerationStatus(@Param('id') id: string) {
    const { status, progress, url, upscaled_urls } =
      await this.genAiService.getGenerationStatus(id);

    const aiGenerated = await this.productsService.updateAiGeneration(id, {
      status,
      progress,
      imageUrl: url,
      generatedImageUrls: upscaled_urls ? upscaled_urls.join(',') : undefined,
    });

    return {
      success: true,
      data: aiGenerated,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('card/credit')
  async getAiCardCredit(@Request() req) {
    const userId = req?.user?.id;
    const remainingCredit =
      await this.productsService.countAiRemainingCredit(userId);

    return {
      success: true,
      remainingCredit,
    };
  }

  @Post('send-for-redesign')
  @UseGuards(JwtAuthGuard)
  async sendProductsForRedesign(
    @Body() body: SendForRedesignDto,
    @Request() req,
  ) {
    // Get user from database to retrieve association name
    const user = await this.userRepository.findOne({
      where: { id: req.user.id },
      select: ['name_association'],
    });
    
    const associationName = user?.name_association || 'Unknown Association';
    
    return await this.productsService.sendProductsForRedesign(body.products, associationName);
  }

  @Post('refresh-pdf-processing')
  async refreshProductPdfProcessing(
    @Body() body: { productIds: number[] | number },
  ) {
    if (!body.productIds) {
      throw new BadRequestException('productIds is required');
    }

    // Normalize to array format
    const productIds = Array.isArray(body.productIds) ? body.productIds : [body.productIds];

    if (productIds.length === 0) {
      throw new BadRequestException('At least one productId is required');
    }

    return await this.productsService.refreshProductPdfProcessing(productIds);
  }

  @Public()
  @Get('weekly-export/printer')
  async sendWeeklyPrinterExport(@Query('startDate') startDate?: string) {
    return await this.productsService.sendWeeklyPrinterExport(startDate);
  }

  @Post('update-print-url/:id')
  async updatePrintUrl(
    @Param('id') id: string,
    @Query('format') format: string = 'standard',
    @Body() body: { file_url?: string; token?: string },
    @Headers('authorization') authHeader?: string,
  ) {
    const webhookToken = process.env.WEBHOOK_TOKEN;
    const providedToken = body.token || authHeader?.replace('Bearer ', '');

    if (providedToken !== webhookToken) {
      throw new ForbiddenException('Invalid webhook token');
    }

    if (!body.file_url) {
      throw new BadRequestException('file_url is required');
    }

    if (!['standard', 'collector'].includes(format)) {
      throw new BadRequestException('format must be either "standard" or "collector"');
    }

    const updateData = format === 'collector'
      ? { collectorPrintUrl: body.file_url }
      : { printUrl: body.file_url };

    await this.productRepository.update(+id, updateData);

    const formatName = format === 'collector' ? 'Collector' : 'Standard';
    return {
      success: true,
      message: `${formatName} print URL updated for product ${id}`,
    };
  }
}
