import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Campaign, TagOption } from './entities/campaign.entity';
import { TranslatorService } from '../common/translator/translator.service';
import { UploadService } from '../common/upload/upload.service';
import path from 'path';
import { Celebrity } from '../celebrities/entities/celebrity.entity';
import { Thematic } from '../thematics/entities/thematic.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Celebrity)
    private readonly celebrityRepository: Repository<Celebrity>,
    @InjectRepository(Thematic)
    private readonly thematicRepository: Repository<Thematic>,
    private readonly translatorService: TranslatorService,
    private readonly uploadService: UploadService,
  ) {}

  async create(createCampaignDto: any, file: Express.Multer.File) {
    if (file) {
      createCampaignDto.video = file
        ? await this.uploadService.uploadFile(file.buffer, {
            ContentType: file.mimetype,
            Key: `uploads/videos/${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`,
          })
        : '';
    }

    const celebrityId = createCampaignDto.celebrityId;
    delete createCampaignDto.celebrityId;

    if (createCampaignDto.tags && Array.isArray(createCampaignDto.tags)) {
      createCampaignDto.tags = createCampaignDto.tags.filter((tag) =>
        Object.values(TagOption).includes(tag as TagOption),
      );
    }

    const campaign = await this.campaignRepository.save({
      ...createCampaignDto,
      handleDistribution: true,
      multilingualDescription: createCampaignDto.description
        ? await this.translatorService.translateAll(
            createCampaignDto.description,
          )
        : undefined,
    });

    if (celebrityId) {
      const celebrity = await this.celebrityRepository.findOne({
        where: { id: celebrityId },
      });

      if (celebrity) {
        campaign.celebrities = [celebrity];
        await this.campaignRepository.save(campaign);
      }
    }

    return campaign;
  }

  findAll() {
    return this.campaignRepository.find({
      where: { deleted: false },
    });
  }

  async findAllMyCampaigns(id: number) {
    return await this.campaignRepository.query(
      `
      SELECT campaign.*, (
        SELECT COUNT(product.id) FROM product 
        WHERE product.campaign_id = campaign.id
      ) as productCount 
      FROM campaign 
      WHERE campaign.user_id = ? AND campaign.deleted = false
    `,
      [id],
    );
  }

  async findOne(id: number, userId: number) {
    const campaign = await this.campaignRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['user', 'celebrities', 'products', 'thematic'],
    });
    if (!campaign) {
      throw new ForbiddenException('Campaign not found');
    }
    delete campaign.user;
    return campaign;
  }

  async update(
    id: number,
    updateCampaignDto: UpdateCampaignDto,
    userId: number,
  ) {
    let campaign = await this.findCampaignOrFail(id, userId);

    // Make a copy to track what needs to be updated in updateCampaignFields
    const remainingUpdates = { ...updateCampaignDto };

    // Handle thematic relation
    campaign = await this.updateThematic(campaign, updateCampaignDto);
    delete remainingUpdates.thematicId;

    // Handle celebrities relation
    await this.updateCelebrities(campaign, updateCampaignDto);
    delete remainingUpdates.celebrityIds;

    // Handle tags validation
    this.validateTags(remainingUpdates);

    // Update any remaining simple fields
    if (Object.keys(remainingUpdates).length > 0) {
      await this.updateCampaignFields(id, remainingUpdates);
    }

    return this.findOne(id, userId);
  }

  private async findCampaignOrFail(
    id: number,
    userId: number,
  ): Promise<Campaign> {
    const campaign = await this.campaignRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['user', 'celebrities', 'thematic'],
    });

    if (!campaign) {
      throw new ForbiddenException('Campaign not found');
    }

    if (!campaign.celebrities) {
      campaign.celebrities = [];
    }

    return campaign;
  }

  private async updateThematic(
    campaign: Campaign,
    updateCampaignDto: UpdateCampaignDto,
  ): Promise<Campaign> {
    if (updateCampaignDto.thematicId !== undefined) {
      if (updateCampaignDto.thematicId === null) {
        campaign.thematic = null;
      } else {
        const thematic = await this.thematicRepository.findOne({
          where: { id: updateCampaignDto.thematicId },
        });
        if (!thematic) {
          throw new NotFoundException(
            `Thematic with ID ${updateCampaignDto.thematicId} not found`,
          );
        }
        campaign.thematic = thematic;

        await this.campaignRepository.save(campaign);

        return campaign;
      }
      delete updateCampaignDto.thematicId;
    }
    return campaign;
  }

  private async updateCelebrities(
    campaign: Campaign,
    updateCampaignDto: UpdateCampaignDto,
  ): Promise<void> {
    if (
      updateCampaignDto.celebrityIds &&
      updateCampaignDto.celebrityIds.length > 0
    ) {
      const celebrities = await this.celebrityRepository.findBy({
        id: In(updateCampaignDto.celebrityIds),
      });

      const campaignToUpdate = await this.campaignRepository.findOne({
        where: { id: campaign.id },
        relations: ['celebrities'],
      });

      if (campaignToUpdate) {
        campaignToUpdate.celebrities = celebrities;

        try {
          await this.campaignRepository.save(campaignToUpdate);
        } catch (error) {
          console.error('Error saving campaign with celebrities:', error);
          throw error;
        }
      } else {
        console.error(
          `Campaign with ID ${campaign.id} not found when trying to update celebrities`,
        );
      }

      delete updateCampaignDto.celebrityIds;
    }
  }

  private validateTags(updateCampaignDto: UpdateCampaignDto): void {
    if (updateCampaignDto.tags && Array.isArray(updateCampaignDto.tags)) {
      updateCampaignDto.tags = updateCampaignDto.tags.filter((tag) =>
        Object.values(TagOption).includes(tag as TagOption),
      );
    }
  }

  private async updateCampaignFields(
    id: number,
    updateCampaignDto: UpdateCampaignDto,
  ): Promise<void> {
    if (Object.keys(updateCampaignDto).length === 0) {
      return;
    }

    const { date_start, date_end, description, ...restOfDto } =
      updateCampaignDto;
    const updateData: Partial<Campaign> = { ...restOfDto };

    if (date_start) {
      updateData.date_start = new Date(date_start);
    }
    if (date_end) {
      updateData.date_end = new Date(date_end);
    }

    if (description !== undefined) {
      updateData.multilingualDescription = description
        ? await this.translatorService.translateAll(description)
        : null;
    }

    await this.campaignRepository.update(id, updateData);
  }

  async updateBackgroundImage(
    campaignId: number,
    imageUrl: string,
    userId: number,
  ) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId, user: { id: userId } },
      relations: ['user'],
    });

    if (!campaign) {
      throw new ForbiddenException(
        `You don't have permission to update this campaign`,
      );
    }

    campaign.banner_image = imageUrl;
    return this.campaignRepository.save(campaign);
  }

  async remove(id: number, userId: number) {
    const campaign = await this.campaignRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['user'],
    });

    if (!campaign) {
      throw new ForbiddenException('Campaign not found');
    }

    const products = await this.productRepository.find({
      where: { campaign: { id } },
    });


    if (!products.length) {
      return await this.campaignRepository.delete(id);
    }

    if (products.length > 0) {
      campaign.deleted = true;
      return await this.campaignRepository.save(campaign);
    }
  }
}
