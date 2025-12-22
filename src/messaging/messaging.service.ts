import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Order } from '../payment/entities/order.entity';
import { Email, EmailStatus } from './entities/email.entity';
import { IMessageConnector } from './interfaces/message-connector.interface';
import { GcpEmailConnector } from './connectors/gcp-email.connector';
import { WhatsAppConnector } from './connectors/whatsapp.connector';
import { MessageProvider } from './dto/send-message.dto';
import { GetDonatorsDto } from './dto/get-donators.dto';
import { GetEmailsDto } from './dto/get-emails.dto';
import { parse } from 'csv-parse/sync';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly connectors: Map<MessageProvider, IMessageConnector>;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    private readonly gcpEmailConnector: GcpEmailConnector,
    private readonly whatsAppConnector: WhatsAppConnector,
  ) {
    this.connectors = new Map<MessageProvider, IMessageConnector>([
      [MessageProvider.EMAIL, this.gcpEmailConnector],
      [MessageProvider.WHATSAPP, this.whatsAppConnector],
    ]);
  }

  getConnector(provider: MessageProvider): IMessageConnector {
    const connector = this.connectors.get(provider);
    if (!connector) {
      throw new BadRequestException(`Provider ${provider} not supported`);
    }
    return connector;
  }

  async getDonatorEmails(filters: GetDonatorsDto): Promise<
    Array<{
      email: string;
      name: string;
      lastname: string;
    }>
  > {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .innerJoin('order.user', 'user')
      .select(['user.email', 'user.name', 'user.lastname'])
      .distinct(true)
      .where('order.status = :status', { status: 'succeeded' });

    if (filters.associationId) {
      queryBuilder
        .innerJoin('order.userProducts', 'up')
        .innerJoin('up.product', 'product')
        .innerJoin('product.campaign', 'campaign')
        .andWhere('campaign.user_id = :associationId', {
          associationId: filters.associationId,
        });
    }

    if (filters.purchaseTypes && filters.purchaseTypes.length > 0) {
      queryBuilder.andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('1')
          .from('order', 'o')
          .where('o.id = order.id')
          .andWhere(
            `JSON_CONTAINS(o.items, JSON_OBJECT('productType', :productType))`,
          )
          .getQuery();

        return `EXISTS (${subQuery})`;
      });

      queryBuilder.setParameter('productType', filters.purchaseTypes[0]);
    }

    const results = await queryBuilder.getRawMany();

    return results.map((r) => ({
      email: r.user_email,
      name: r.user_name || '',
      lastname: r.user_lastname || '',
    }));
  }

  async importCsvEmails(csvContent: string): Promise<
    Array<{
      email: string;
      name?: string;
    }>
  > {
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      const emailSet = new Set<string>();
      const cleanedEmails: Array<{ email: string; name?: string }> = [];

      for (const record of records) {
        const email = this.extractEmail(record);
        if (email && this.isValidEmail(email) && !emailSet.has(email)) {
          emailSet.add(email);
          cleanedEmails.push({
            email,
            name: (record as any).name || (record as any).Name || (record as any).firstname || '',
          });
        }
      }

      this.logger.log(
        `Imported and cleaned ${cleanedEmails.length} emails from CSV`,
      );
      return cleanedEmails;
    } catch (error) {
      this.logger.error(`Failed to parse CSV: ${error.message}`);
      throw new BadRequestException('Invalid CSV format');
    }
  }

  private extractEmail(record: any): string | null {
    const emailFields = ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail'];
    for (const field of emailFields) {
      if (record[field]) {
        return record[field].toLowerCase().trim();
      }
    }
    return null;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async getSentEmails(
    userId: number,
    filters: GetEmailsDto,
  ): Promise<{
    emails: Email[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.emailRepository
      .createQueryBuilder('email')
      .where('email.userId = :userId', { userId })
      .andWhere('email.status = :status', { status: EmailStatus.SENT })
      .orderBy('email.sentAt', 'DESC');

    if (filters.search) {
      queryBuilder.andWhere(
        '(email.subject LIKE :search OR email.body LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const total = await queryBuilder.getCount();
    const offset = (filters.page - 1) * filters.limit;

    const emails = await queryBuilder
      .skip(offset)
      .take(filters.limit)
      .getMany();

    return {
      emails,
      total,
      page: filters.page,
      limit: filters.limit,
    };
  }

  async getDraftEmails(
    userId: number,
    filters: GetEmailsDto,
  ): Promise<{
    emails: Email[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.emailRepository
      .createQueryBuilder('email')
      .where('email.userId = :userId', { userId })
      .andWhere('email.status = :status', { status: EmailStatus.DRAFT })
      .orderBy('email.updatedAt', 'DESC');

    if (filters.search) {
      queryBuilder.andWhere(
        '(email.subject LIKE :search OR email.body LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const total = await queryBuilder.getCount();
    const offset = (filters.page - 1) * filters.limit;

    const emails = await queryBuilder
      .skip(offset)
      .take(filters.limit)
      .getMany();

    return {
      emails,
      total,
      page: filters.page,
      limit: filters.limit,
    };
  }

  async saveEmailAsDraft(
    userId: number,
    emailData: {
      subject: string;
      body: string;
      htmlBody?: string;
      recipients: Array<{ email: string; name?: string }>;
      provider: MessageProvider;
    },
  ): Promise<Email> {
    const email = this.emailRepository.create({
      subject: emailData.subject,
      body: emailData.body,
      htmlBody: emailData.htmlBody,
      recipients: emailData.recipients,
      provider: emailData.provider,
      userId,
      status: EmailStatus.DRAFT,
      recipientCount: emailData.recipients.length,
    });

    return await this.emailRepository.save(email);
  }

  async saveEmailAsSent(
    userId: number,
    emailData: {
      subject: string;
      body: string;
      htmlBody?: string;
      recipients: Array<{ email?: string; phone?: string; name?: string }>;
      provider: MessageProvider;
    },
    sendResult: {
      success: boolean;
      sentCount: number;
      failedCount: number;
      errors?: Array<{
        recipient: { email?: string; phone?: string; name?: string };
        error: string;
      }>;
    },
  ): Promise<Email> {
    const email = this.emailRepository.create({
      subject: emailData.subject,
      body: emailData.body,
      htmlBody: emailData.htmlBody,
      recipients: emailData.recipients,
      provider: emailData.provider,
      userId,
      status: EmailStatus.SENT,
      recipientCount: emailData.recipients.length,
      sentAt: new Date(),
      sendResult,
    });

    return await this.emailRepository.save(email);
  }

  async saveDraft(
    userId: number,
    draftData: {
      id?: number;
      subject?: string;
      body?: string;
      htmlBody?: string;
      recipients?: Array<{ email?: string; phone?: string; name?: string }>;
      provider?: MessageProvider;
    },
  ): Promise<Email> {
    // If ID is provided, update existing draft
    if (draftData.id) {
      const existingDraft = await this.emailRepository.findOne({
        where: { id: draftData.id, userId, status: EmailStatus.DRAFT },
      });

      if (!existingDraft) {
        throw new BadRequestException('Draft not found or already sent');
      }

      // Update only provided fields
      if (draftData.subject !== undefined) existingDraft.subject = draftData.subject;
      if (draftData.body !== undefined) existingDraft.body = draftData.body;
      if (draftData.htmlBody !== undefined) existingDraft.htmlBody = draftData.htmlBody;
      if (draftData.recipients !== undefined) {
        existingDraft.recipients = draftData.recipients;
        existingDraft.recipientCount = draftData.recipients.length;
      }
      if (draftData.provider !== undefined) existingDraft.provider = draftData.provider;

      return await this.emailRepository.save(existingDraft);
    }

    // Create new draft
    const draft = this.emailRepository.create({
      subject: draftData.subject || '',
      body: draftData.body || '',
      htmlBody: draftData.htmlBody,
      recipients: draftData.recipients || [],
      provider: draftData.provider || MessageProvider.EMAIL,
      userId,
      status: EmailStatus.DRAFT,
      recipientCount: draftData.recipients?.length || 0,
    });

    return await this.emailRepository.save(draft);
  }

  async getDraftById(userId: number, draftId: number): Promise<Email | null> {
    return await this.emailRepository.findOne({
      where: { id: draftId, userId, status: EmailStatus.DRAFT },
    });
  }

  async deleteDraft(userId: number, draftId: number): Promise<void> {
    const draft = await this.emailRepository.findOne({
      where: { id: draftId, userId, status: EmailStatus.DRAFT },
    });

    if (!draft) {
      throw new BadRequestException('Draft not found');
    }

    await this.emailRepository.remove(draft);
  }
}
