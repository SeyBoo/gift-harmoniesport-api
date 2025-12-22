import {
  Injectable,
  UploadedFiles,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateCardDto } from './dto/create-card.dto';
import { ProductForRedesignDto } from './dto/send-for-redesign.dto';
import { Product } from './entities/product.entity';
import {
  Between,
  FindOptionsWhere,
  In,
  Not,
  Repository,
  IsNull,
} from 'typeorm';
import { UserProduct } from './entities/userproduct.entity';
import { User } from '../users/entities/user.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { UserAiGeneration } from '../users/entities/user-ai-generation.entity';
import { extname } from 'path';
import { TranslatorService } from '../common/translator/translator.service';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { Order, OrderItem } from '../payment/entities/order.entity';
import { Jimp } from 'jimp';
import {
  UploadItem,
  UploadItemStatus,
} from '../common/upload/entities/upload-item.entity';
import { UploadStatus } from '../common/upload/entities/upload-session.entity';
import { UploadService } from '../common/upload/upload.service';
import { Celebrity } from '../celebrities/entities/celebrity.entity';
import { OpenAI } from 'openai';
import { MailjetService } from '../common/mailjet/mailjet.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProductsService {
  public readonly MAX_CREDITS = 10;
  private readonly CREDIT_WINDOW_HOURS = 2;
  private readonly logger = new Logger(ProductsService.name);
  private readonly openai: OpenAI;

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(UserProduct)
    private readonly userProductRepository: Repository<UserProduct>,
    @InjectRepository(UserAiGeneration)
    private readonly userAiGenerationRepository: Repository<UserAiGeneration>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Celebrity)
    private readonly celebrityRepository: Repository<Celebrity>,
    private uploadService: UploadService,
    private translatorService: TranslatorService,
    private mailjetService: MailjetService,
    private httpService: HttpService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  async suggestCardDescription(
    associationName: string,
    campaignName: string,
    cardName: string,
  ) {
    try {
      const association = await this.userRepository.findOne({
        where: { name_association: associationName },
      });

      const cardDescription = await this.generateCardDescriptionWithAI(
        associationName,
        campaignName,
        cardName,
        association,
      );

      // Translate the description to all supported languages
      const translatedDescription = await this.translatorService.translateAll(
        cardDescription.description,
      );

      return {
        description: cardDescription.description,
        message_donation: cardDescription.messageDonation,
        message_celebrity: cardDescription.messageCelebrity,
        multilingual_description: translatedDescription,
        multilingual_message_donation:
          await this.translatorService.translateAll(
            cardDescription.messageDonation,
          ),
        multilingual_message_celebrity:
          await this.translatorService.translateAll(
            cardDescription.messageCelebrity,
          ),
      };
    } catch (error) {
      this.logger.error(`Error suggesting card description: ${error.message}`);
      throw error;
    }
  }

  private async generateCardDescriptionWithAI(
    associationName: string,
    campaignName: string,
    cardName: string,
    association: User,
  ) {
    const prompt = `En tant qu'expert en rédaction de contenu pour cartes de don caritatives, crée une description pour une carte numérique de la plateforme Giftasso.
Association: "${associationName}"
Campagne: "${campaignName}"
Nom de la carte: "${cardName}"
Informations sur l'association: ${JSON.stringify({
      name: association.name_association,
      description: association.description,
    })}
Génère une réponse en français au format JSON avec les champs suivants:
{
  "description": "Une description détaillée de la carte, mentionnant l'impact positif de l'achat et le lien avec la mission de l'association (150-200 mots)",
  "messageDonation": "Un court message de remerciement qui sera affiché au donateur (30-50 mots)",
  "messageCelebrity": "Un message que pourrait dire la célébrité associée à cette carte, en lien avec la cause (30-50 mots)"
}
Le contenu doit être inspirant, émotionnel et mettre en avant l'impact concret de la contribution.`;

    const completion = await this.openai.chat.completions.create({
      messages: [{ role: 'system', content: prompt }],
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  async uploadCardFiles(files: {
    [key: string]: Express.Multer.File[];
  }): Promise<Record<string, string | null>> {
    const uploadPromises = Object.keys(
      this.uploadService.FIELD_TO_PATH_UPLOAD,
    ).map(async (fieldname) => {
      // Check if files object exists and has the fieldname property
      if (!files || !Object.prototype.hasOwnProperty.call(files, fieldname)) {
        return { [fieldname]: null };
      }

      const fileArray = files[fieldname];

      if (!fileArray || fileArray.length === 0) {
        return { [fieldname]: null };
      }

      const file = fileArray[0];
      const buffer = file.buffer;
      const contentType = file.mimetype;
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const extension = this.getExtensionFromMimeType(
        contentType,
        file.originalname,
      );

      // Log PDF detection
      if (contentType === 'application/pdf') {
        this.logger.log(
          `Processing PDF file: ${file.originalname} for field ${fieldname}`,
        );
      }

      const key = `${this.uploadService.FIELD_TO_PATH_UPLOAD[fieldname]}/${fieldname}-${uniqueSuffix}${extension}`;

      const url = await this.uploadService.uploadFile(buffer, {
        ContentType: contentType,
        Key: key,
      });

      // The returned URL will be for the PNG if it was a PDF, or the original file otherwise
      return { [fieldname]: url };
    });

    const uploadResults = await Promise.all(uploadPromises);

    // Filter out any undefined values before reducing
    const rawResults = uploadResults.filter(Boolean).reduce((acc, curr) => {
      const [key, value] = Object.entries(curr)[0];
      if (value !== null) {
        acc[key] = value;
      }
      return acc;
    }, {});

    // Map field names to entity field names
    const fieldMapping: Record<string, string> = {
      collector_image: 'collectorImageUrl',
      digital_image: 'digitalImageUrl',
      magnet_image: 'magnetImageUrl',
    };

    const mappedResults: Record<string, string | null> = {};
    Object.entries(rawResults).forEach(([key, value]) => {
      const mappedKey = fieldMapping[key] || key;
      mappedResults[mappedKey] = value;
    });

    return mappedResults;
  }

  private getExtensionFromMimeType(
    mimeType: string,
    originalFilename: string,
  ): string {
    if (mimeType === 'application/pdf') {
      return '.pdf';
    }
    if (mimeType.startsWith('image/')) {
      const format = mimeType.split('/')[1];
      return format === 'jpeg' ? '.jpg' : `.${format}`;
    }
    if (mimeType.startsWith('video/')) {
      const format = mimeType.split('/')[1];
      return `.${format}`;
    }
    // Fallback to original extension if we can't determine from mime type
    return originalFilename ? extname(originalFilename) : '.jpg';
  }

  async doesSlugExist(slug: string): Promise<boolean> {
    const existingProduct = await this.productRepository.findOne({
      where: { slug },
    });
    return !!existingProduct;
  }

  async generateUniqueSlug(product: Product, user: User): Promise<string> {
    const baseSlug = user?.name_association
      ? `${user?.name_association}-${product.name}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : product.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-');

    let uniqueSlug = baseSlug;
    let counter = 0;
    const maxRetries = 100;

    while (await this.doesSlugExist(uniqueSlug)) {
      counter++;
      if (counter > maxRetries) {
        throw new Error(
          `Unable to generate a unique slug for "${product.name}" after ${maxRetries} attempts.`,
        );
      }
      uniqueSlug = `${baseSlug}-${counter}`;
    }

    return uniqueSlug;
  }

  async createCard(
    createCardDto: CreateCardDto,
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
    if (!createCardDto.quantity) {
      throw new ForbiddenException('Missing quantity');
    }
    let userAssociation = null;
    if (createCardDto.campaign) {
      userAssociation = (
        await this.campaignRepository.findOne({
          where: {
            id: createCardDto.campaign as any,
          },
          relations: ['user'],
        })
      )?.user;
    }
    const qty = Number(createCardDto.quantity);
    createCardDto = {
      ...createCardDto,
      ...(await this.uploadCardFiles(files)),
    };

    if (createCardDto.generateImageId) {
      const generatedImage =
        await this.userAiGenerationRepository.findOneOrFail({
          where: {
            id: createCardDto.generateImageId,
          },
        });
      createCardDto.generateImageId = undefined;
      createCardDto.image = generatedImage?.imageUrl;
    }
    if (createCardDto.imageUrl) {
      try {
        let firstImageUrl = createCardDto.imageUrl;

        if (typeof firstImageUrl === 'string') {
          if (firstImageUrl.includes(',')) {
            firstImageUrl = firstImageUrl.split(',')[0].trim();
          }
        } else if (Array.isArray(firstImageUrl)) {
          firstImageUrl = firstImageUrl[0];
        } else {
          this.logger.error(
            `Unexpected imageUrl type: ${typeof firstImageUrl}`,
          );
          throw new Error('Invalid image URL format');
        }

        this.logger.log(`Processing image from URL: ${firstImageUrl}`);

        const buffer = await this.uploadService.getBufferFromUrl(firstImageUrl);
        if (buffer && buffer.data) {
          createCardDto.image = await this.uploadService.uploadFile(
            buffer.data,
            {
              ContentType: buffer.contentType,
              Key: `uploads/cards-image/${Date.now()}.jpg`,
            },
          );
        } else {
          this.logger.error(
            `Invalid buffer received for imageUrl: ${firstImageUrl}`,
          );
          throw new Error('Failed to retrieve image from URL');
        }
        createCardDto.imageUrl = undefined;
      } catch (error) {
        this.logger.error(`Error uploading image from URL: ${error.message}`);
        throw new ForbiddenException('Unable to process image URL');
      }
    }
    const productCreated = this.productRepository.create({
      ...createCardDto,
      handleDistribution: createCardDto.handleDistribution === 'true',
      price:
        typeof createCardDto.price === 'string'
          ? JSON.parse(createCardDto.price)
          : createCardDto.price,
      multilingualMessageCelebrity: createCardDto.message_celebrity
        ? await this.translatorService.translateAll(
            createCardDto.message_celebrity,
          )
        : undefined,
      multilingualMessageDonation: createCardDto.message_donation
        ? await this.translatorService.translateAll(
            createCardDto.message_donation,
          )
        : undefined,
    });
    if (!createCardDto.slug) {
      try {
        productCreated.slug = await this.generateUniqueSlug(
          productCreated,
          userAssociation,
        );
      } catch (e) {
        this.logger.error(e);
      }
    }
    await this.productRepository.save(productCreated);

    const userProducts = [...new Array(qty)].map(() =>
      this.userProductRepository.create({
        userId: null,
        productId: productCreated.id,
        tokenId: '0',
      }),
    );

    await this.userProductRepository.save(userProducts);

    // Call PDF processor API to generate print URL
    if (productCreated.image) {
      try {
        await this.callPdfProcessorApi(productCreated);
      } catch (error) {
        this.logger.error(
          `Error calling PDF processor API for product ${productCreated.id}:`,
          error,
        );
      }
    }

    return productCreated;
  }

  async createBulkCardFromUploadSession(
    uploadItems: UploadItem[],
    campaign: Campaign,
    uploadSessionId: string,
  ): Promise<Product[]> {
    const productItems = uploadItems.filter(
      (e) => e.status === UploadItemStatus.COMPLETED && e.imageUrl !== null,
    );
    const products = productItems.map((product) =>
      this.productRepository.create({
        name: product.productName,
        message_donation: '',
        message_celebrity: '',
        image: product.imageUrl,
        campaign,
        price: product.price,
        currency: 'EUR',
        slug: product.slug,
      }),
    );
    const savedProducts = await this.productRepository.save(products);

    const userProducts = savedProducts.flatMap((product, index) => {
      const item = productItems[index];
      const quantity = item?.quantity ?? 1;

      return [...Array(quantity)].map(() =>
        this.userProductRepository.create({
          userId: null,
          productId: product.id,
          tokenId: '0',
        }),
      );
    });
    await this.userProductRepository.save(userProducts);
    await this.uploadService.updateUploadSession(uploadSessionId, {
      status: UploadStatus.COMPLETED,
    });
    return savedProducts;
  }

  async updateCard(
    cardId: number,
    updateCardDto: CreateCardDto,
    files: {
      video_promo?: Express.Multer.File[];
      video_thanks?: Express.Multer.File[];
      image?: Express.Multer.File[];
      collector_image?: Express.Multer.File[];
      digital_image?: Express.Multer.File[];
      magnet_image?: Express.Multer.File[];
    },
  ): Promise<Product> {
    const existingCard = await this.productRepository.findOne({
      where: { id: cardId },
    });

    if (!existingCard) {
      const errorMessage = `Card with id ${cardId} not found`;
      this.logger.error(errorMessage);
      throw new NotFoundException(errorMessage);
    }

    let updatedData: Partial<Product> = {
      ...updateCardDto,
      handleDistribution: updateCardDto.handleDistribution === 'true',
      price:
        typeof updateCardDto.price === 'string'
          ? JSON.parse(updateCardDto.price)
          : updateCardDto.price,
    };

    if (files && Object.keys(files).length > 0) {
      const fileUploads = await this.uploadCardFiles(files);
      updatedData = { ...updatedData, ...fileUploads };
    }

    if (
      updateCardDto.imageUrl &&
      updateCardDto.imageUrl !== existingCard.image
    ) {
      try {
        const buffer = await this.uploadService.getBufferFromUrl(
          updateCardDto.imageUrl,
        );
        if (buffer && buffer.data) {
          updatedData.image = await this.uploadService.uploadFile(buffer.data, {
            ContentType: buffer.contentType,
            Key: `uploads/cards-image/${Date.now()}.jpg`,
          });
        } else {
          throw new Error('Failed to retrieve buffer data');
        }
      } catch (error) {
        const errorMessage = `Error uploading image for cardId: ${cardId}`;
        this.logger.error(errorMessage, error);
        throw new Error(errorMessage);
      }
      delete updatedData.imageUrl;
    }

    if (updateCardDto.celebrityId) {
      const celebrity = await this.celebrityRepository.findOne({
        where: { id: updateCardDto.celebrityId },
      });

      if (!celebrity) {
        throw new NotFoundException('Celebrity not found');
      }

      updatedData.celebrity = celebrity;

      delete updateCardDto.celebrityId;
      delete (updatedData as any).celebrityId;
    }

    if (updateCardDto.generateImageId) {
      try {
        const generatedImage =
          await this.userAiGenerationRepository.findOneOrFail({
            where: { id: updateCardDto.generateImageId },
          });
        updatedData.image = generatedImage?.imageUrl;
        delete (updatedData as any).generateImageId;
      } catch (e) {
        this.logger.error(
          `Error finding generated image for cardId: ${cardId}`,
          e,
        );
      }
    }

    if (updatedData.message_celebrity !== existingCard.message_celebrity) {
      updatedData.multilingualMessageCelebrity =
        await this.translatorService.translateAll(
          updatedData.message_celebrity,
        );
    }
    if (updatedData.message_donation !== existingCard.message_donation) {
      updatedData.multilingualMessageDonation =
        await this.translatorService.translateAll(updatedData.message_donation);
    }

    if (updatedData['image_url']) {
      delete updatedData['image_url'];
    }

    await this.productRepository.update(cardId, {
      ...updatedData,
      image: updatedData.image || existingCard.image,
    });

    const updatedCard = await this.productRepository.findOne({
      where: { id: cardId },
    });

    // Check if image was updated and call PDF processor API
    const imageChanged =
      (updatedData.image && updatedData.image !== existingCard.image) ||
      (files && files.image && files.image.length > 0) ||
      (updateCardDto.imageUrl &&
        updateCardDto.imageUrl !== existingCard.image) ||
      updateCardDto.generateImageId;

    if (imageChanged && updatedCard.image) {
      try {
        await this.callPdfProcessorApi(updatedCard);
      } catch (error) {
        this.logger.error(
          `Error calling PDF processor API for updated product ${cardId}:`,
          error,
        );
      }
    }

    return updatedCard;
  }

  async deleteCard(id: number) {
    const userProducts = await this.userProductRepository.find({
      where: { productId: id, userId: Not(IsNull()) },
    });
    if (userProducts.length > 0) {
      throw new ForbiddenException('Card has purchases');
    }

    // Get the product to access file URLs
    const product = await this.productRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    try {
      // Delete uploaded files
      await this.deleteProductFiles(product);

      // Delete user products and product
      await this.userProductRepository.delete({ productId: id });
      await this.productRepository.delete(id);
    } catch (error) {
      throw error;
    }
  }

  private async deleteProductFiles(product: Product): Promise<void> {
    const filesToDelete: string[] = [];

    // Extract file keys from URLs
    if (product.image) {
      const imageKey = this.extractS3KeyFromUrl(product.image);
      if (imageKey) {
        filesToDelete.push(imageKey);
        // Also delete the unlocked version if it exists
        const unlockedKey = imageKey.replace(
          'uploads/cards-image/',
          'uploads/cards-image-unlocked/',
        );
        filesToDelete.push(unlockedKey);
      }
    }

    if (product.imageUrl) {
      const imageUrlKey = this.extractS3KeyFromUrl(product.imageUrl);
      if (imageUrlKey) {
        filesToDelete.push(imageUrlKey);
        // Also delete the unlocked version if it exists
        const unlockedKey = imageUrlKey.replace(
          'uploads/cards-image/',
          'uploads/cards-image-unlocked/',
        );
        filesToDelete.push(unlockedKey);
      }
    }

    if (product.video_promo) {
      const videoPromoKey = this.extractS3KeyFromUrl(product.video_promo);
      if (videoPromoKey) {
        filesToDelete.push(videoPromoKey);
      }
    }

    if (product.video_thanks) {
      const videoThanksKey = this.extractS3KeyFromUrl(product.video_thanks);
      if (videoThanksKey) {
        filesToDelete.push(videoThanksKey);
      }
    }

    // Delete files from S3
    const deletePromises = filesToDelete.map(async (key) => {
      try {
        await this.uploadService.deleteFile(key);
        this.logger.log(`Deleted file: ${key}`);
      } catch (error) {
        this.logger.error(`Failed to delete file ${key}:`, error);
        // Continue with other deletions even if one fails
      }
    });

    await Promise.all(deletePromises);
  }

  private extractS3KeyFromUrl(url: string): string | null {
    if (!url || !url.includes(this.uploadService.getS3Uri())) {
      return null;
    }

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Remove leading slash and return the key
      return pathname.startsWith('/') ? pathname.substring(1) : pathname;
    } catch (error) {
      this.logger.error(`Failed to extract S3 key from URL: ${url}`, error);
      return null;
    }
  }

  async findProductByCampaign(id: Campaign, pagination: PaginationDto) {
    const { page = 1, limit = 10, search } = pagination;
    const offset = (page - 1) * limit;

    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.userProducts', 'up')
      .where('product.campaign = :id', { id });

    if (search) {
      query.andWhere('product.name LIKE :search', { search: `%${search}%` });
    }

    query.skip(offset).take(limit);

    const countQuery = this.productRepository
      .createQueryBuilder('product')
      .where('product.campaign = :id', { id });

    if (search) {
      countQuery.andWhere('product.name LIKE :search', {
        search: `%${search}%`,
      });
    }

    countQuery.select('COUNT(DISTINCT product.id)', 'count');

    const [items, totalResult] = await Promise.all([
      query.getMany(),
      countQuery.getRawOne(),
    ]);

    const total = parseInt(totalResult.count, 10) / limit;

    const itemsWithPurchaseStatus = items.map((item) => ({
      ...item,
      purchased: !!item.userProducts?.length,
    }));

    return {
      items: itemsWithPurchaseStatus,
      total,
      page,
      limit,
    };
  }

  async countUserProduct(options: FindOptionsWhere<UserProduct>) {
    return await this.userProductRepository.count({
      where: options,
    });
  }

  async findUserProducts(
    options: FindOptionsWhere<UserProduct>,
    limit: number,
    order?: Record<string, 'DESC' | 'ASC'>,
  ): Promise<UserProduct[]> {
    return await this.userProductRepository.find({
      where: options,
      take: limit,
      order,
    });
  }

  async updateUserProduct(id: number, options: Partial<UserProduct>) {
    return await this.userProductRepository.update(id, options);
  }

  async updateUserProducts(ids: number[], options: Partial<UserProduct>) {
    return await this.userProductRepository.update({ id: In(ids) }, options);
  }

  async getCampaign(where: FindOptionsWhere<Campaign>): Promise<Campaign> {
    return await this.campaignRepository.findOne({
      where,
    });
  }

  async findAll() {
    return await this.productRepository.find();
  }

  async findOne(id: number, relations?: string[]) {
    return await this.productRepository.findOne({
      where: { id },
      relations,
    });
  }

  async findMyDons(id: number) {
    const orders = await this.userProductRepository.manager
      .createQueryBuilder(Order, 'o')
      .innerJoin(User, 'u', 'o.user_id = u.id')
      .select([
        'o.id',
        'o.items',
        'o.ia_thanks_video',
        'o.created_at',
        'u.name_association',
      ])
      .where('u.id = :id', { id })
      .andWhere('o.status = :status', { status: 'succeeded' })
      .getRawMany();

    const dons = [];

    for (const order of orders) {
      if (!order['o_items'] || !Array.isArray(order['o_items'])) {
        continue;
      }

      for (const item of order['o_items']) {
        const product = await this.productRepository
          .createQueryBuilder('p')
          .innerJoin(Campaign, 'c', 'p.campaign_id = c.id')
          .innerJoin(User, 'a', 'c.user_id = a.id')
          .select([
            'p.*',
            'c.description',
            'a.name_association as association_name',
          ])
          .where('p.id = :productId', { productId: item.productId })
          .getRawOne();

        if (product) {
          dons.push({
            ...product,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            orderId: order.id,
            ia_thanks_video: order.ia_thanks_video,
            created_at: order.created_at,
            name_association: order.name_association,
            image: product.image.replace(
              'uploads/cards-image/',
              'uploads/cards-image-unlocked/',
            ),
            associationName: product.association_name,
            productType: item.productType,
            price: item.totalPrice,
          });
        }
      }
    }

    return dons;
  }

  async createAiGeneration(
    data: Partial<UserAiGeneration>,
  ): Promise<UserAiGeneration> {
    const userAiGen = this.userAiGenerationRepository.create(data);
    return await this.userAiGenerationRepository.save(userAiGen);
  }

  private async addAssociationLogoToImage(associationId: number, url: string) {
    const association = await this.userRepository.findOneBy({
      id: associationId,
    });
    if (!association) {
      throw new Error('Association not found');
    }
    const associationLogo = association.logo;

    // Get the buffer for the main image and the association logo
    const { data: buffer } = await this.uploadService.getBufferFromUrl(url);
    const associationLogoBuffer =
      await this.uploadService.getBufferFromUrl(associationLogo);

    // Read images with Jimp
    const associationLogoImage = await Jimp.read(associationLogoBuffer.data);
    const image = await Jimp.read(buffer);

    const targetSize = 200; // specify the desired width
    associationLogoImage.scaleToFit({
      w: targetSize,
      h: targetSize,
    });

    const padding = 20;
    const x = image.bitmap.width - associationLogoImage.bitmap.width - padding;
    const y = padding;
    image.composite(associationLogoImage, x, y);

    const dataImg = await image.getBuffer('image/png');
    return dataImg;
  }

  async selectAiGeneration(associationId: number, id: number, url: string) {
    const association = await this.userRepository.findOneBy({
      id: associationId,
    });

    if (!association) {
      throw new Error('Association not found');
    }

    const userAiGen = await this.userAiGenerationRepository.findOneBy({
      id,
    });

    if (!userAiGen) {
      throw new Error('Generation not found');
    }

    const image: Buffer = await this.addAssociationLogoToImage(
      associationId,
      url,
    );

    const fileName = `uploads/cards-image/image-${new Date().getTime()}.png`;

    return await this.userAiGenerationRepository.update(
      { id: userAiGen.id },
      {
        imageName: fileName,
        imageUrl: await this.uploadService.uploadFile(image, {
          ContentType: 'image/png',
          Key: fileName,
        }),
      },
    );
  }

  async updateAiGeneration(
    id: string,
    data: Partial<UserAiGeneration>,
  ): Promise<UserAiGeneration> {
    const userAiGen = await this.userAiGenerationRepository.findOneBy({
      webhookId: id,
    });

    if (!userAiGen) {
      throw new Error('Generation not found');
    }

    return await this.userAiGenerationRepository.save({
      ...userAiGen,
      ...data,
    });
  }

  async countAiRemainingCredit(userId: number): Promise<number> {
    const now = new Date();
    const creditWindowStart = new Date();
    creditWindowStart.setHours(
      creditWindowStart.getHours() - this.CREDIT_WINDOW_HOURS,
    );
    const generationCount = await this.userAiGenerationRepository.count({
      where: {
        userId: userId,
        createdAt: Between(creditWindowStart, now),
      },
    });

    const remainingCredits = this.MAX_CREDITS - generationCount;

    return remainingCredits > 0 ? remainingCredits : 0;
  }

  async sendProductsForRedesign(
    productsData: ProductForRedesignDto[],
    associationName: string,
  ): Promise<{
    success: boolean;
    message: string;
    count: number;
    products: ProductForRedesignDto[];
  }> {
    try {
      if (!productsData || productsData.length === 0) {
        return {
          success: true,
          message: 'No products provided for redesign',
          count: 0,
          products: [],
        };
      }

      this.logger.log(
        `Received ${productsData.length} products for redesign from ${associationName}`,
      );

      // Generate CSV content
      const csvContent = this.generateProductsCSV(
        productsData,
        associationName,
      );

      // Send email with CSV attachment
      await this.mailjetService.sendEmail(
        'antoine@giftasso.com',
        `Products for Redesign - ${new Date().toLocaleDateString()}`,
        `Hi Antoine,\n\nPlease find attached ${productsData.length} products that need to be redesigned.\n\nAssociation: ${associationName}\nProducts include card variant information for context.\n\nBest regards,\nGiftAsso Team`,
        `<h2>Products for Redesign</h2><p>Hi Antoine,</p><p>Please find attached <strong>${productsData.length}</strong> products that need to be redesigned.</p><p><strong>Association:</strong> ${associationName}</p><p>Products include card variant information for context.</p><p>Best regards,<br>GiftAsso Team</p>`,
        {
          ContentType: 'text/csv',
          Filename: `products-for-redesign-${new Date().toISOString().split('T')[0]}.csv`,
          Base64Content: Buffer.from(csvContent).toString('base64'),
        },
      );

      return {
        success: true,
        message: `Successfully sent ${productsData.length} products for redesign`,
        count: productsData.length,
        products: productsData,
      };
    } catch (error) {
      this.logger.error('Error processing products for redesign:', error);
      throw error;
    }
  }

  private generateProductsCSV(
    products: ProductForRedesignDto[],
    associationName: string,
  ): string {
    const csvRows = [];

    for (const product of products) {
      // Create a simple array format with individual elements
      const productData = [
        product.firstName || '',
        product.lastName || '',
        product.team || '',
        product.year || '',
        product.playerFaceUrl || '',
        product.cardDesign || '',
        associationName,
      ];

      csvRows.push(productData.join(','));
    }

    return csvRows.join('\n');
  }

  private async callPdfProcessorApi(product: Product): Promise<void> {
    const webhookToken = process.env.WEBHOOK_TOKEN;

    // Convert locked image URL to unlocked version for PDF processing
    const unlockedImageUrl = product.image.replace(
      'uploads/cards-image/',
      'uploads/cards-image-unlocked/',
    );

    // First API call for standard print_url
    const standardPayload = {
      image_url: unlockedImageUrl,
      webhook_url: `${process.env.API_URL}/products/update-print-url/${product.id}?format=standard`,
      webhook_method: 'POST',
      webhook_token: webhookToken,
      format_type: 'standard',
    };

    // Second API call for collector print_url
    const collectorPayload = {
      image_url: unlockedImageUrl,
      webhook_url: `${process.env.API_URL}/products/update-print-url/${product.id}?format=collector`,
      webhook_method: 'POST',
      webhook_token: webhookToken,
      format_type: 'collector',
    };

    try {
      // Make both API calls in parallel
      const [standardResponse, collectorResponse] = await Promise.all([
        firstValueFrom(
          this.httpService.post(
            'https://yh4xls6l5lb4itamsm3qsrr4sy0rsqyu.lambda-url.eu-west-1.on.aws/process-image/',
            standardPayload,
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          ),
        ),
        firstValueFrom(
          this.httpService.post(
            'https://yh4xls6l5lb4itamsm3qsrr4sy0rsqyu.lambda-url.eu-west-1.on.aws/process-image/',
            collectorPayload,
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          ),
        ),
      ]);

      if (standardResponse.status !== 200) {
        throw new Error(
          `PDF processor API (standard) responded with status: ${standardResponse.status}`,
        );
      }

      if (collectorResponse.status !== 200) {
        throw new Error(
          `PDF processor API (collector) responded with status: ${collectorResponse.status}`,
        );
      }

      this.logger.log(
        `Successfully called PDF processor API for both standard and collector formats for product ${product.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to call PDF processor API for product ${product.id}:`,
        error,
      );
      throw error;
    }
  }

  async refreshProductPdfProcessing(productIds: number[]): Promise<{
    success: boolean;
    message: string;
    results: Array<{ productId: number; success: boolean; error?: string }>;
  }> {
    const results = [];

    for (const productId of productIds) {
      try {
        const product = await this.productRepository.findOne({
          where: { id: productId },
        });

        if (!product) {
          results.push({
            productId,
            success: false,
            error: 'Product not found',
          });
          continue;
        }

        if (!product.image) {
          results.push({
            productId,
            success: false,
            error: 'Product has no image',
          });
          continue;
        }

        // Reset print URLs to trigger fresh processing
        await this.productRepository.update(productId, {
          printUrl: null,
          collectorPrintUrl: null,
        });

        // Call PDF processor API
        await this.callPdfProcessorApi(product);

        results.push({
          productId,
          success: true,
        });

        this.logger.log(
          `Successfully refreshed PDF processing for product ${productId}`,
        );
      } catch (error) {
        results.push({
          productId,
          success: false,
          error: error.message,
        });
        this.logger.error(
          `Failed to refresh PDF processing for product ${productId}:`,
          error,
        );
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    return {
      success: failureCount === 0,
      message: `Processed ${productIds.length} products: ${successCount} successful, ${failureCount} failed`,
      results,
    };
  }

  async generateWeeklyPrinterExport(startDate?: string): Promise<{
    productExport: string;
    deliveryExport: string;
    orderIds: number[];
  }> {
    const queryBuilder = this.productRepository.manager
      .createQueryBuilder()
      .select([
        'o.id',
        'o.items',
        'o.delivery_address',
        'o.delivery_address_information',
        'o.delivery_city',
        'o.delivery_postalcode',
        'o.delivery_country',
        'o.delivery_state',
        'o.delivery_phone',
        'o.firstname',
        'o.lastname',
        'o.created_at',
      ])
      .from('order', 'o')
      .where('o.status = :status', { status: 'succeeded' });

    if (startDate) {
      // Manual export: use date range
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('o.created_at BETWEEN :start AND :end', { start, end });
    } else {
      // Cron: only unexported orders
      queryBuilder.andWhere('o.exported = :exported', { exported: false });
    }

    const orders = await queryBuilder.getRawMany();

    // Process orders to aggregate product quantities by type
    const productCounts = new Map<
      string,
      {
        productId: number;
        productName: string;
        productImage: string;
        printUrl: string;
        collectorPrintUrl: string;
        quantities: {
          collector: number;
          magnet: number;
          digital: number;
        };
      }
    >();

    const deliveryItems = [];

    // Create a map to cache product information
    const productCache = new Map<
      number,
      {
        name: string;
        image: string;
        printUrl: string;
        collectorPrintUrl: string;
      }
    >();

    for (const orderRow of orders) {
      try {
        if (!orderRow.o_items) {
          this.logger.warn(
            `Order ${orderRow.o_id} has invalid or missing items, skipping.`,
          );
          continue;
        }
        const items: OrderItem[] = orderRow.o_items;

        for (const item of items) {
          const productId = parseInt(item.productId);
          const productType = item.productType as string;
          const quantity = item.quantity || 0;

          // Skip digital products for printing
          if (productType === 'digital') continue;

          // Get product information from cache or database
          let productInfo = productCache.get(productId);
          if (!productInfo) {
            const product = await this.productRepository.findOne({
              where: { id: productId },
              select: ['id', 'name', 'image', 'printUrl', 'collectorPrintUrl'],
            });

            if (product) {
              productInfo = {
                name: product.name,
                image: product.image,
                printUrl: product.printUrl,
                collectorPrintUrl: product.collectorPrintUrl,
              };
              productCache.set(productId, productInfo);
            } else {
              this.logger.warn(
                `Product ${productId} not found for order ${orderRow.o_id}`,
              );
              continue;
            }
          }

          // Aggregate product counts
          const key = `${productId}-${productInfo.name}`;
          if (!productCounts.has(key)) {
            productCounts.set(key, {
              productId,
              productName: productInfo.name,
              productImage: productInfo.image,
              printUrl: productInfo.printUrl,
              collectorPrintUrl: productInfo.collectorPrintUrl,
              quantities: { collector: 0, magnet: 0, digital: 0 },
            });
          }

          const product = productCounts.get(key);
          product.quantities[productType] += quantity;

          // Add to delivery items (only for physical products)
          if (productType !== 'digital') {
            deliveryItems.push({
              orderId: orderRow.o_id,
              productId,
              productName: productInfo.name,
              productType,
              quantity,
              customerName:
                `${orderRow.o_firstname} ${orderRow.o_lastname}`.trim(),
              deliveryAddress: orderRow.o_delivery_address,
              deliveryAddressInfo: orderRow.o_delivery_address_information,
              deliveryCity: orderRow.o_delivery_city,
              deliveryPostalcode: orderRow.o_delivery_postalcode,
              deliveryCountry: orderRow.o_delivery_country,
              deliveryState: orderRow.o_delivery_state,
              deliveryPhone: orderRow.o_delivery_phone,
              orderDate: new Date(orderRow.o_created_at),
            });
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to parse order items for order ${orderRow.o_id}:`,
          error,
        );
        continue;
      }
    }

    // Generate product export CSV
    const productExport = this.generateProductExportCSV(
      Array.from(productCounts.values()),
    );

    // Generate delivery export CSV
    const deliveryExport = this.generateDeliveryExportCSV(deliveryItems);

    // Collect unique order IDs
    const orderIds = [...new Set(orders.map((o) => o.o_id))];

    return {
      productExport,
      deliveryExport,
      orderIds,
    };
  }

  private generateProductExportCSV(
    products: Array<{
      productId: number;
      productName: string;
      productImage: string;
      printUrl: string;
      collectorPrintUrl: string;
      quantities: { collector: number; magnet: number; digital: number };
    }>,
  ): string {
    const headers = [
      'Product ID',
      'Product Name',
      'Collector Quantity',
      'Magnet Quantity',
      'Total Physical Quantity',
      'Product Image URL',
      'Print URL',
    ];

    const rows = [headers.join(',')];

    for (const product of products) {
      const totalPhysical =
        product.quantities.collector + product.quantities.magnet;

      // Only include products that have physical items to print
      if (totalPhysical > 0) {
        const row = [
          product.productId,
          `"${product.productName.replace(/"/g, '""')}"`,
          product.quantities.collector,
          product.quantities.magnet,
          totalPhysical,
          `"${product.productImage || ''}"`,
          `"${product.collectorPrintUrl || ''}"`,
        ];
        rows.push(row.join(','));
      }
    }

    return rows.join('\n');
  }

  private generateDeliveryExportCSV(
    deliveryItems: Array<{
      orderId: number;
      productId: number;
      productName: string;
      productType: string;
      quantity: number;
      customerName: string;
      deliveryAddress: string;
      deliveryAddressInfo: string;
      deliveryCity: string;
      deliveryPostalcode: string;
      deliveryCountry: string;
      deliveryState: string;
      deliveryPhone: string;
      orderDate: Date;
    }>,
  ): string {
    const headers = [
      'Order ID',
      'Product ID',
      'Product Name',
      'Product Type',
      'Quantity',
      'Customer Name',
      'Delivery Address',
      'Address Info',
      'City',
      'Postal Code',
      'Country',
      'State',
      'Phone',
      'Order Date',
    ];

    const rows = [headers.join(',')];

    for (const item of deliveryItems) {
      const dateString =
        item.orderDate instanceof Date && !isNaN(item.orderDate.getTime())
          ? item.orderDate.toISOString()
          : '';

      const row = [
        item.orderId,
        item.productId,
        `"${item.productName.replace(/"/g, '""')}"`,
        item.productType,
        item.quantity,
        `"${item.customerName.replace(/"/g, '""')}"`,
        `"${(item.deliveryAddress || '').replace(/"/g, '""')}"`,
        `"${(item.deliveryAddressInfo || '').replace(/"/g, '""')}"`,
        `"${(item.deliveryCity || '').replace(/"/g, '""')}"`,
        `"${(item.deliveryPostalcode || '').replace(/"/g, '""')}"`,
        `"${(item.deliveryCountry || '').replace(/"/g, '""')}"`,
        `"${(item.deliveryState || '').replace(/"/g, '""')}"`,
        `"${(item.deliveryPhone || '').replace(/"/g, '""')}"`,
        dateString,
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  async sendWeeklyPrinterExport(startDate?: string): Promise<{
    success: boolean;
    message: string;
    ordersExported: number;
  }> {
    try {
      // Generate both CSV files
      const { productExport, deliveryExport, orderIds } =
        await this.generateWeeklyPrinterExport(startDate);

      const today = new Date().toISOString().split('T')[0];

      // Send email with products CSV attachment
      await this.mailjetService.sendEmail(
        'antoine@giftasso.com',
        `Weekly Printer Export - Products - ${today}`,
        `Hi Antoine,\n\nPlease find attached the weekly printer export file for products to print (collector cards, magnets, etc.).\n\nOrders exported: ${orderIds.length}\nGenerated on: ${today}\n\nBest regards,\nGiftAsso Team`,
        `<h2>Weekly Printer Export - Products</h2><p>Hi Antoine,</p><p>Please find attached the weekly printer export file for <strong>products to print</strong> (collector cards, magnets, etc.).</p><p><strong>Orders exported:</strong> ${orderIds.length}<br><strong>Generated on:</strong> ${today}</p><p>Best regards,<br>GiftAsso Team</p>`,
        {
          ContentType: 'text/csv',
          Filename: `printer_products_${today}.csv`,
          Base64Content: Buffer.from(productExport).toString('base64'),
        },
      );

      // Send email with delivery CSV attachment
      await this.mailjetService.sendEmail(
        'antoine@giftasso.com',
        `Weekly Printer Export - Delivery - ${today}`,
        `Hi Antoine,\n\nPlease find attached the weekly printer export file for delivery information.\n\nOrders exported: ${orderIds.length}\nGenerated on: ${today}\n\nBest regards,\nGiftAsso Team`,
        `<h2>Weekly Printer Export - Delivery</h2><p>Hi Antoine,</p><p>Please find attached the weekly printer export file for <strong>delivery information</strong>.</p><p><strong>Orders exported:</strong> ${orderIds.length}<br><strong>Generated on:</strong> ${today}</p><p>Best regards,<br>GiftAsso Team</p>`,
        {
          ContentType: 'text/csv',
          Filename: `delivery_info_${today}.csv`,
          Base64Content: Buffer.from(deliveryExport).toString('base64'),
        },
      );

      // Mark orders as exported
      if (orderIds.length > 0) {
        await this.productRepository.manager
          .createQueryBuilder()
          .update('order')
          .set({ exported: true })
          .where('id IN (:...ids)', { ids: orderIds })
          .execute();

        this.logger.log(`Marked ${orderIds.length} orders as exported`);
      }

      this.logger.log('Successfully sent weekly printer export email');

      return {
        success: true,
        message: 'Weekly printer export email sent successfully',
        ordersExported: orderIds.length,
      };
    } catch (error) {
      this.logger.error('Error sending weekly printer export email:', error);
      throw error;
    }
  }
}
