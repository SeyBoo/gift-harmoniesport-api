import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  IMessageConnector,
  MessagePayload,
  MessageRecipient,
  MessageResult,
} from '../interfaces/message-connector.interface';

@Injectable()
export class GcpEmailConnector implements IMessageConnector {
  private readonly logger = new Logger(GcpEmailConnector.name);
  private readonly sesClient: SESClient;

  constructor() {
    this.sesClient = new SESClient({
      region: process.env.AWS_SES_REGION || 'eu-north-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async send(payload: MessagePayload): Promise<MessageResult> {
    const result: MessageResult = {
      success: true,
      sentCount: 0,
      failedCount: 0,
      errors: [],
    };

    const validRecipients = payload.recipients.filter((r) =>
      this.validateRecipient(r),
    );

    if (validRecipients.length === 0) {
      result.success = false;
      return result;
    }

    const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@giftasso.com';

    try {
      this.logger.log(
        `Sending email to ${validRecipients.length} recipients via Amazon SES`,
      );

      for (const recipient of validRecipients) {
        try {
          // Replace placeholders with recipient data
          const personalizedSubject = this.replacePlaceholders(
            payload.subject || 'No Subject',
            recipient,
          );
          const personalizedBody = this.replacePlaceholders(
            payload.body,
            recipient,
          );
          const personalizedHtmlBody = payload.htmlBody
            ? this.replacePlaceholders(payload.htmlBody, recipient)
            : undefined;

          const command = new SendEmailCommand({
            Source: fromEmail,
            Destination: {
              ToAddresses: [recipient.email],
            },
            Message: {
              Subject: {
                Data: personalizedSubject,
                Charset: 'UTF-8',
              },
              Body: {
                Html: personalizedHtmlBody ? {
                  Data: personalizedHtmlBody,
                  Charset: 'UTF-8',
                } : undefined,
                Text: {
                  Data: personalizedBody,
                  Charset: 'UTF-8',
                },
              },
            },
          });

          await this.sesClient.send(command);
          this.logger.debug(`Email sent successfully to ${recipient.email}`);
          result.sentCount++;
        } catch (error) {
          this.logger.error(`Failed to send email to ${recipient.email}: ${error.message}`);
          result.failedCount++;
          result.errors.push({
            recipient,
            error: error.message,
          });
        }
      }

      result.success = result.sentCount > 0;
    } catch (error) {
      this.logger.error(`Failed to send emails via Amazon SES: ${error.message}`);
      result.success = false;
    }

    return result;
  }

  private replacePlaceholders(
    content: string,
    recipient: MessageRecipient,
  ): string {
    let result = content;

    // Replace {{email}} placeholder
    result = result.replace(/\{\{email\}\}/g, recipient.email || '');

    // Replace {{name}} placeholder
    result = result.replace(/\{\{name\}\}/g, recipient.name || '');

    return result;
  }

  validateRecipient(recipient: MessageRecipient): boolean {
    if (!recipient.email) {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(recipient.email);
  }

  getProviderName(): string {
    return 'Amazon SES';
  }
}
