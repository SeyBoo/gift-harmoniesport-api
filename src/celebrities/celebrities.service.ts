import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, In, Like, Repository } from 'typeorm';
import { CreateCelebrityDto } from './dto/create-celebrity.dto';
import { UpdateCelebrityDto } from './dto/update-celebrity.dto';
import { Celebrity } from './entities/celebrity.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { TranslatorService } from '../common/translator/translator.service';
import { OpenAI } from 'openai';
import { Logger } from '@nestjs/common';
import { ChatGPTRequestDto } from './dto/ask-chatgpt.dto';
import { CelebritiesUtils } from './utils/celebrities.utils';
import { HttpService } from '@nestjs/axios';
import { CelebrityMin } from './celebrities.interface';
import { AskCelebrityDto } from './dto/ask-celebrity.dto';
import { SuccessResponse } from '../common/interfaces';

@Injectable()
export class CelebritiesService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(CelebritiesService.name);

  constructor(
    @InjectRepository(Celebrity)
    private readonly celebrityRepository: Repository<Celebrity>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly translationService: TranslatorService,
    private readonly celebritiesUtils: CelebritiesUtils,
    private readonly httpService: HttpService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  async askForNewCelebrity(
    payload: AskCelebrityDto,
    userId: number,
  ): Promise<SuccessResponse> {
    const newCelebrity = await this.celebrityRepository.save({
      associations: [userId],
      instagramUrl: payload.instagramUrl,
      name: payload.name,
    });

    const message = !!newCelebrity
      ? `Congratulations! Your celebrity has been created.`
      : `Sorry, there's been an issue with the creation of your celebrity. Please try again later.`;

    return {
      success: !!newCelebrity,
      message,
    };
  }

  async dontAcceptCelebrity(celebrityId: number): Promise<SuccessResponse> {
    const celebrity = await this.celebrityRepository.findOne({
      where: { id: celebrityId },
    });

    if (!celebrity) {
      throw new NotFoundException(`Celebrity with ID ${celebrityId} not found`);
    }

    await this.celebrityRepository.delete(celebrityId);
    
    return {
      success: true,
      message: `Celebrity with ID ${celebrityId} has been removed.`,
    };
  }

  async create(createCelebrityDto: CreateCelebrityDto): Promise<Celebrity> {
    const translatedJobTitle = await this.translationService.translateAll(
      createCelebrityDto.jobTitle,
      'fr',
    );

    const translatedDescription = await this.translationService.translateAll(
      createCelebrityDto.description,
      'fr',
    );

    const savedCelebrity = await this.celebrityRepository.save({
      ...createCelebrityDto,
      jobTitle: translatedJobTitle,
      description: translatedDescription,
      isConfirmed: true,
    });

    for (const productId of createCelebrityDto.cards) {
      await this.productRepository.update(productId, {
        celebrity: savedCelebrity,
      });
    }

    return savedCelebrity;
  }

  async findAll(
    page: number,
    limit: number,
    search?: string,
  ): Promise<{
    data: Celebrity[];
    page: number;
    count: number;
    total: number;
  }> {
    const skip = (page - 1) * limit;
    const data = await this.celebrityRepository.find({
      skip,
      take: limit,
      where: search
        ? { name: Like(`%${search}%`), isDeleted: false }
        : { isDeleted: false },
    });

    const numberOfItems = await this.celebrityRepository.count();
    const count = Math.ceil(numberOfItems / limit);

    const formattedData = await this.celebritiesUtils.formatCelebrities(data);

    return {
      data: formattedData,
      page,
      count,
      total: numberOfItems,
    };
  }

  async findAllMinified(
    page: number,
    limit: number,
    language: string,
    search?: string,
    associationId?: number,
  ): Promise<{
    data: CelebrityMin[];
    page: number;
    count: number;
    total: number;
  }> {
    const skip = (page - 1) * limit;
    
    let queryBuilder = this.celebrityRepository
      .createQueryBuilder('celebrity')
      .where('celebrity.isDeleted = :isDeleted', { isDeleted: false });
    
    if (search) {
      queryBuilder = queryBuilder.andWhere('celebrity.name LIKE :search', { 
        search: `%${search}%` 
      });
    }
    
    if (associationId) {
      queryBuilder = queryBuilder.andWhere('celebrity.associations LIKE :associationId', { 
        associationId: `%${associationId}%` 
      });
    }

    const data = await queryBuilder
      .skip(skip)
      .take(limit)
      .getMany();

    const numberOfItems = await queryBuilder.getCount();
    const count = Math.ceil(numberOfItems / limit);

    const formattedData = await this.celebritiesUtils.formatCelebritiesMin(
      data,
      language,
    );

    return {
      data: formattedData,
      page,
      count,
      total: numberOfItems,
    };
  }

  async findOne(id: number): Promise<{
    celebrity: Celebrity;
    products: Product[];
    associations: User[];
  }> {
    const celebrity = await this.celebrityRepository.findOne({ where: { id } });

    if (!celebrity) {
      throw new NotFoundException(`Celebrity with ID ${id} not found`);
    }

    const products = await this.productRepository.find({
      where: { celebrity: { id } },
    });

    const associations = await this.userRepository.find({
      where: { id: In(celebrity.associations) },
      select: ['id', 'name_association', 'logo', 'slug'],
    });

    const formattedCelebrity =
      await this.celebritiesUtils.formatCelebrity(celebrity);

    return { celebrity: formattedCelebrity, products, associations };
  }

  async update(
    id: number,
    updateCelebrityDto: UpdateCelebrityDto,
  ): Promise<Celebrity> {
    const celebrity = await this.celebrityRepository.findOne({
      where: { id },
    });

    if (!celebrity) {
      throw new NotFoundException(`Celebrity with ID ${id} not found`);
    }

    // Get all existing products associated with this celebrity
    const existingProducts = await this.productRepository.find({
      where: { celebrity: { id } },
    });

    // Remove celebrity from products that are no longer in the cards list
    const existingProductIds = existingProducts.map(p => p.id);
    const productsToRemove = existingProductIds.filter(
      productId => !updateCelebrityDto.cards.includes(productId)
    );

    for (const productId of productsToRemove) {
      await this.productRepository.update(productId, {
        celebrity: null,
      });
    }

    // Add celebrity to new products
    for (const productId of updateCelebrityDto.cards) {
      await this.productRepository.update(productId, {
        celebrity: celebrity,
      });
    }

    const translatedJobTitle = await this.translationService.translateAll(
      updateCelebrityDto.jobTitle,
      'fr',
    );

    const translatedDescription = await this.translationService.translateAll(
      updateCelebrityDto.description,
      'fr',
    );

    delete updateCelebrityDto.cards;

    await this.celebrityRepository.update(id, {
      ...updateCelebrityDto,
      jobTitle: translatedJobTitle,
      description: translatedDescription,
      isConfirmed: true,
    });

    const updatedCelebrity = await this.celebrityRepository.findOne({
      where: { id },
    });

    return updatedCelebrity;
  }

  async remove(id: number): Promise<DeleteResult> {
    const result = await this.celebrityRepository.update(id, {
      isDeleted: true,
    });

    if (result.affected === 0) {
      throw new NotFoundException(`Celebrity with ID ${id} not found`);
    }

    return result;
  }

  async askChatGPT({
    prompt,
    systemPrompt = 'You are a helpful assistant.',
    temperature = 0.7,
    format = 'text',
  }: ChatGPTRequestDto) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              format === 'json'
                ? `${systemPrompt} You must respond with valid JSON only.`
                : systemPrompt,
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1024,
        temperature,
        response_format: format === 'json' ? { type: 'json_object' } : { type: 'text' },
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from ChatGPT');
      }
      return format === 'json' ? JSON.parse(content) : { response: content };
    } catch (error) {
      this.logger.error(
        'ChatGPT request failed:',
        error.response?.data || error,
      );
      throw error;
    }
  }

  async askPerplexity({
    prompt,
    systemPrompt = 'You are a helpful assistant.',
    temperature = 0.7,
    format = 'text',
  }: ChatGPTRequestDto) {
    try {
      const response = await this.httpService
        .post(
          'https://api.perplexity.ai/chat/completions',
          {
            model: 'sonar',
            messages: [
              {
                role: 'system',
                content:
                  format === 'json'
                    ? `${systemPrompt} You must respond with valid JSON only.`
                    : systemPrompt,
              },
              { role: 'user', content: prompt },
            ],
            max_tokens: 1024,
            temperature,
            top_p: 0.9,
            return_images: false,
            return_related_questions: false,
            search_recency_filter: 'month',
            top_k: 0,
            stream: false,
            presence_penalty: 0,
            frequency_penalty: 1,
            response_format: {
              type: 'text',
            },
            web_search_options: {
              search_context_size: 'high',
            },
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
            },
          },
        )
        .toPromise();

      const content = response.data.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from Perplexity');
      }
      return format === 'json' ? JSON.parse(content) : { response: content };
    } catch (error) {
      this.logger.error(
        'Perplexity request failed:',
        error.response?.data || error,
      );
      throw error;
    }
  }
}
