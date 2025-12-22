import { Injectable, Logger } from '@nestjs/common';
import {
  IMessageConnector,
  MessagePayload,
  MessageRecipient,
  MessageResult,
} from '../interfaces/message-connector.interface';

@Injectable()
export class WhatsAppConnector implements IMessageConnector {
  private readonly logger = new Logger(WhatsAppConnector.name);

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

    try {
      // TODO: Implement WhatsApp Business API integration
      // Example: Use WhatsApp Cloud API or Twilio
      // - Configure API credentials from environment
      // - Send messages to phone numbers
      // - Handle rate limiting and retries

      this.logger.log(
        `Sending WhatsApp message to ${validRecipients.length} recipients`,
      );

      // Placeholder implementation
      for (const recipient of validRecipients) {
        try {
          // Replace placeholders with recipient data
          const personalizedBody = this.replacePlaceholders(
            payload.body,
            recipient,
          );

          // Actual WhatsApp sending logic would go here
          this.logger.debug(
            `Would send WhatsApp to ${recipient.phone}: ${personalizedBody}`,
          );
          result.sentCount++;
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            recipient,
            error: error.message,
          });
        }
      }

      result.success = result.sentCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp messages: ${error.message}`,
      );
      result.success = false;
    }

    return result;
  }

  private replacePlaceholders(
    content: string,
    recipient: MessageRecipient,
  ): string {
    let result = content;

    // Replace {{phone}} placeholder
    result = result.replace(/\{\{phone\}\}/g, recipient.phone || '');

    // Replace {{name}} placeholder
    result = result.replace(/\{\{name\}\}/g, recipient.name || '');

    return result;
  }

  validateRecipient(recipient: MessageRecipient): boolean {
    if (!recipient.phone) {
      return false;
    }
    // Basic phone validation - should be E.164 format for WhatsApp
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(recipient.phone);
  }

  getProviderName(): string {
    return 'WhatsApp Business API';
  }
}
