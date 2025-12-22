import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Request,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/send-message.dto';
import { GetDonatorsDto } from './dto/get-donators.dto';
import { GetEmailsDto } from './dto/get-emails.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/auth/guards/admin.guard';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('donators/emails')
  async getDonatorEmails(@Query() filters: GetDonatorsDto, @Request() req) {
    // Extract user ID from JWT token and add to filters
    const filtersWithUserId = {
      ...filters,
      associationId: req.user.id,
    };
    const emails = await this.messagingService.getDonatorEmails(filtersWithUserId);
    return {
      count: emails.length,
      data: emails,
    };
  }

  @Post('import-csv')
  @UseInterceptors(FileInterceptor('file'))
  async importCsvEmails(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are allowed');
    }

    const csvContent = file.buffer.toString('utf-8');
    const cleanedEmails =
      await this.messagingService.importCsvEmails(csvContent);

    return {
      count: cleanedEmails.length,
      data: cleanedEmails,
    };
  }

  @Post('send')
  async sendMessage(@Body() sendMessageDto: SendMessageDto, @Request() req) {
    const connector = this.messagingService.getConnector(
      sendMessageDto.provider,
    );

    const result = await connector.send({
      subject: sendMessageDto.subject,
      body: sendMessageDto.body,
      htmlBody: sendMessageDto.htmlBody,
      recipients: sendMessageDto.recipients,
    });

    // Convert recipients to the format expected by the service
    const validRecipients = sendMessageDto.recipients
      .filter(r => r.email)
      .map(r => ({
        email: r.email!,
        name: r.name,
      }));

    // Convert result errors to match the expected type
    const convertedResult = {
      success: result.success,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      errors: result.errors?.map(error => ({
        recipient: {
          email: error.recipient.email || '',
          name: error.recipient.name,
        },
        error: error.error,
      })),
    };

    // Save the email as sent in the database
    await this.messagingService.saveEmailAsSent(
      req.user.id,
      {
        subject: sendMessageDto.subject || '',
        body: sendMessageDto.body,
        htmlBody: sendMessageDto.htmlBody,
        recipients: validRecipients,
        provider: sendMessageDto.provider,
      },
      convertedResult,
    );

    return {
      success: result.success,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      errors: result.errors,
      provider: connector.getProviderName(),
    };
  }

  @Get('sent')
  async getSentEmails(@Query() filters: GetEmailsDto, @Request() req) {
    const result = await this.messagingService.getSentEmails(req.user.id, filters);

    return {
      emails: result.emails.map(email => ({
        id: email.id,
        subject: email.subject,
        status: email.status,
        recipientCount: email.recipientCount,
        createdAt: email.createdAt,
        sentAt: email.sentAt,
        sendResult: email.sendResult,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get('drafts')
  async getDraftEmails(@Query() filters: GetEmailsDto, @Request() req) {
    const result = await this.messagingService.getDraftEmails(req.user.id, filters);

    return {
      emails: result.emails.map(email => ({
        id: email.id,
        subject: email.subject,
        status: email.status,
        recipientCount: email.recipientCount,
        createdAt: email.createdAt,
        updatedAt: email.updatedAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Post('drafts')
  async saveDraft(@Body() saveDraftDto: SaveDraftDto, @Request() req) {
    const draft = await this.messagingService.saveDraft(req.user.id, saveDraftDto);

    return {
      id: draft.id,
      subject: draft.subject,
      body: draft.body,
      htmlBody: draft.htmlBody,
      recipients: draft.recipients,
      provider: draft.provider,
      status: draft.status,
      recipientCount: draft.recipientCount,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  @Put('drafts/:id')
  async updateDraft(
    @Param('id') id: string,
    @Body() saveDraftDto: SaveDraftDto,
    @Request() req,
  ) {
    const draft = await this.messagingService.saveDraft(req.user.id, {
      ...saveDraftDto,
      id: parseInt(id),
    });

    return {
      id: draft.id,
      subject: draft.subject,
      body: draft.body,
      htmlBody: draft.htmlBody,
      recipients: draft.recipients,
      provider: draft.provider,
      status: draft.status,
      recipientCount: draft.recipientCount,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  @Get('drafts/:id')
  async getDraft(@Param('id') id: string, @Request() req) {
    const draft = await this.messagingService.getDraftById(req.user.id, parseInt(id));

    if (!draft) {
      throw new BadRequestException('Draft not found');
    }

    return {
      id: draft.id,
      subject: draft.subject,
      body: draft.body,
      htmlBody: draft.htmlBody,
      recipients: draft.recipients,
      provider: draft.provider,
      status: draft.status,
      recipientCount: draft.recipientCount,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  @Delete('drafts/:id')
  async deleteDraft(@Param('id') id: string, @Request() req) {
    await this.messagingService.deleteDraft(req.user.id, parseInt(id));

    return {
      success: true,
      message: 'Draft deleted successfully',
    };
  }
}
