import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Faq } from './faq.entity';
import {
  CreateFaqDto,
  UpdateFaqDto,
  ListFaqDto,
  BulkImportFaqDto,
} from './dto';
import { TranslatorService } from '../common/translator/translator.service';
import { SupportedLanguage } from '../common/translator/translator.constant';
import { OpenAI } from 'openai';

@Injectable()
export class FaqService {
  private readonly logger = new Logger(FaqService.name);
  private readonly openai: OpenAI;

  constructor(
    @InjectRepository(Faq)
    private readonly faqRepository: Repository<Faq>,
    private readonly translatorService: TranslatorService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  async createFaq(createFaqDto: CreateFaqDto): Promise<Faq> {
    try {
      const {
        question,
        answer,
        sourceLanguage = 'fr',
        category,
      } = createFaqDto;

      const translationPromises = [
        this.translatorService.translateAll(question, sourceLanguage),
        this.translatorService.translateAll(answer, sourceLanguage),
      ];

      if (category) {
        translationPromises.push(
          this.translatorService.translateAll(category, sourceLanguage),
        );
      }

      const [questionTranslations, answerTranslations, categoryTranslations] =
        await Promise.all(translationPromises);

      if (!questionTranslations || !answerTranslations) {
        throw new Error('Translation failed');
      }

      if (category && !categoryTranslations) {
        throw new Error('Category translation failed');
      }

      const faq = this.faqRepository.create({
        question: questionTranslations,
        answer: answerTranslations,
        category: categoryTranslations || null,
      });

      return await this.faqRepository.save(faq);
    } catch (error) {
      this.logger.error('Failed to create FAQ', error);
      throw error;
    }
  }

  async findAllFaqs(
    listFaqDto?: ListFaqDto,
    search?: string,
  ): Promise<{ data: Faq[]; total: number }> {
    const queryBuilder = this.faqRepository.createQueryBuilder('faq');

    if (search) {
      queryBuilder.where(
        `(JSON_EXTRACT(faq.question, '$.*') LIKE :search OR JSON_EXTRACT(faq.answer, '$.*') LIKE :search OR JSON_EXTRACT(faq.category, '$.*') LIKE :search)`,
        { search: `%${search}%` },
      );
    }

    if (listFaqDto?.category) {
      queryBuilder.andWhere(
        "(JSON_EXTRACT(faq.category, '$.en') LIKE :category OR JSON_EXTRACT(faq.category, '$.fr') LIKE :category OR JSON_EXTRACT(faq.category, '$.es') LIKE :category)",
        { category: `%${listFaqDto.category}%` },
      );
    }

    queryBuilder.orderBy('faq.createdAt', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
    };
  }

  async findOneFaq(id: string): Promise<Faq> {
    const faq = await this.faqRepository.findOne({ where: { id } });
    if (!faq) {
      throw new NotFoundException(`FAQ with ID ${id} not found`);
    }
    return faq;
  }

  async updateFaq(id: string, updateFaqDto: UpdateFaqDto): Promise<Faq> {
    try {
      const faq = await this.findOneFaq(id);
      const {
        question,
        answer,
        sourceLanguage = 'fr',
        category,
      } = updateFaqDto;

      let questionTranslations = faq.question;
      let answerTranslations = faq.answer;
      let categoryTranslations = faq.category;

      if (question) {
        questionTranslations = await this.translatorService.translateAll(
          question,
          sourceLanguage,
        );
        if (!questionTranslations) {
          throw new Error('Question translation failed');
        }
      }

      if (answer) {
        answerTranslations = await this.translatorService.translateAll(
          answer,
          sourceLanguage,
        );
        if (!answerTranslations) {
          throw new Error('Answer translation failed');
        }
      }

      if (category !== undefined) {
        if (category) {
          categoryTranslations = await this.translatorService.translateAll(
            category,
            sourceLanguage,
          );
          if (!categoryTranslations) {
            throw new Error('Category translation failed');
          }
        } else {
          categoryTranslations = null;
        }
      }

      const updatedFaq = await this.faqRepository.save({
        ...faq,
        question: questionTranslations,
        answer: answerTranslations,
        category: categoryTranslations,
      });

      return updatedFaq;
    } catch (error) {
      this.logger.error(`Failed to update FAQ with ID ${id}`, error);
      throw error;
    }
  }

  async removeFaq(id: string): Promise<void> {
    const faq = await this.findOneFaq(id);
    await this.faqRepository.remove(faq);
  }

  async getFaqsForPublicDisplay(
    language: SupportedLanguage = 'fr',
    category?: string,
    search?: string,
  ): Promise<
    {
      id: string;
      question: string;
      answer: string;
      category: string;
      createdAt: Date;
    }[]
  > {
    const queryBuilder = this.faqRepository.createQueryBuilder('faq');

    if (category) {
      queryBuilder.where("(JSON_EXTRACT(faq.category, '$.en') LIKE :category OR JSON_EXTRACT(faq.category, '$.fr') LIKE :category OR JSON_EXTRACT(faq.category, '$.es') LIKE :category)", {
        category: `%${category}%`,
      });
    }

    if (search) {
      queryBuilder.where(
        `(JSON_EXTRACT(faq.question, '$.*') LIKE :search OR JSON_EXTRACT(faq.answer, '$.*') LIKE :search OR JSON_EXTRACT(faq.category, '$.*') LIKE :search)`,
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('faq.createdAt', 'DESC');
    const faqs = await queryBuilder.getMany();

    return faqs.map((faq) => ({
      id: faq.id,
      question:
        faq.question[language] ||
        faq.question['fr'] ||
        Object.values(faq.question)[0],
      answer:
        faq.answer[language] ||
        faq.answer['fr'] ||
        Object.values(faq.answer)[0],
      category: faq.category
        ? faq.category[language] ||
          faq.category['fr'] ||
          Object.values(faq.category)[0]
        : null,
      createdAt: faq.createdAt,
    }));
  }

  async bulkImportFaqs(
    bulkImportDto: BulkImportFaqDto,
  ): Promise<{ success: boolean; imported: number; errors: string[] }> {
    const { text, sourceLanguage = 'en'} = bulkImportDto;

    const faqData = await this.parseTextToFaqWithOpenAI(text);

    if (!faqData.length) {
      throw new Error('Failed to parse any text into FAQ format');
    }

    const results = { success: true, imported: 0, errors: [] as string[] };

    for (const [index, faqItem] of faqData.entries()) {
      try {
        if (!faqItem.question || !faqItem.answer) {
          results.errors.push(`FAQ ${index + 1}: Missing question or answer`);
          continue;
        }

        let finalCategoryTranslations;
        if (faqItem.category) {
          try {
            finalCategoryTranslations = await this.translatorService.translateAll(faqItem.category, 'en');
          } catch (error) {
            console.log('error', error);
            finalCategoryTranslations = { en: faqItem.category, fr: faqItem.category, es: faqItem.category };
          }
        } else {
          finalCategoryTranslations = null;
        }

        const [questionTranslations, answerTranslations] = await Promise.all([
          this.translatorService.translateAll(faqItem.question, sourceLanguage),
          this.translatorService.translateAll(faqItem.answer, sourceLanguage),
        ]);

        if (!questionTranslations || !answerTranslations) {
          results.errors.push(`FAQ ${index + 1}: Translation failed`);
          continue;
        }

        const faq = this.faqRepository.create({
          question: questionTranslations,
          answer: answerTranslations,
          category: finalCategoryTranslations,
        });

        await this.faqRepository.save(faq);
        results.imported++;
      } catch (error) {
        results.errors.push(`FAQ ${index + 1}: ${error.message}`);
      }
    }

    if (results.imported === 0 && results.errors.length > 0) {
      results.success = false;
    }

    return results;
  }

  private async parseTextToFaqWithOpenAI(
    text: string,
  ): Promise<{ question: string; answer: string; category?: string }[]> {
    const validCategories = [
      'Account Management',
      'Payments',
      'Technical Support',
      'Security',
      'Features',
      'Billing',
      'Troubleshooting',
      'General Information',
    ];

    const systemPrompt = `Parse text into FAQ format. Return ONLY valid JSON array with objects containing: question, answer, category.
Use exactly these categories: ${validCategories.join(', ')}.
Questions must end with "?". Example: [{"question":"How do I reset my password?","answer":"Click Forgot Password and follow email instructions.","category":"Account Management"}]`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Parse this text into FAQ format:\n\n${text}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty response from OpenAI');

    const cleanedContent = content
      .replace(/^```(?:json)?\s*/, '')
      .replace(/\s*```$/, '');
    const parsedFaqs = JSON.parse(cleanedContent);

    if (!Array.isArray(parsedFaqs))
      throw new Error('Response must be an array');

    const validatedFaqs = parsedFaqs
      .filter((faq) => faq.question && faq.answer)
      .map((faq) => {
        const question = faq.question.trim().endsWith('?')
          ? faq.question.trim()
          : `${faq.question.trim()}?`;

        const category = validCategories.includes(faq.category)
          ? faq.category
          : 'General Information';
        return {
          question,
          answer: faq.answer.trim(),
          category,
        };
      });

    if (validatedFaqs.length === 0) throw new Error('No valid FAQs generated');

    return validatedFaqs;
  }

  async getCategories(language: SupportedLanguage = 'fr'): Promise<string[]> {
    const faqs = await this.faqRepository.find({
      where: {
        category: Not(IsNull()),
      },
    });

    const categorySet = new Set<string>();

    faqs.forEach((faq) => {
      if (faq.category) {
        const categoryText =
          faq.category[language] ||
          faq.category['fr'] ||
          Object.values(faq.category)[0];
        if (categoryText) {
          categorySet.add(categoryText);
        }
      }
    });

    return Array.from(categorySet).sort();
  }
}
