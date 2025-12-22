import { Injectable, Logger } from '@nestjs/common';
import Mailjet from 'node-mailjet';

interface AttachmentMail {
  ContentType: string;
  Filename: string;
  Base64Content: string;
}
@Injectable()
export class MailjetService {
  private mailjet;
  private readonly logger = new Logger(MailjetService.name);

  public TEMPLATE_ID_BY_SERVICE = {
    REGISTER_USER_ASSOCIATION: 6108616,
    REGISTER_USER_DONOR: 6108616,
    VALIDATE_PAYMENT: 6108611,
    FORGET_PASSWORD: 6108615,
    AFFILIATED_CARD: 6678735,
    ADMIN_PAYMENT_CONFIRMATION: 6763501,
    CREATE_ACCOUNT: 6796499,
    PAYOUT_CONFIRMATION: 7015316,
  };

  constructor() {
    this.mailjet = new Mailjet({
      apiKey: process.env.MAILJET_API_KEY,
      apiSecret: process.env.MAILJET_API_SECRET,
    });
  }

  async sendEmail(to: string, subject: string, text: string, html: string, attachment?: AttachmentMail) {
    const messagePayload = {
      From: {
        Email: 'marketing@metacard.gift',
        Name: 'Metacard giftasso',
      },
      To: [
        {
          Email: to,
          Name: to,
        },
      ],
      Subject: subject,
      TextPart: text,
      HTMLPart: html,
      Attachments: attachment ? [attachment] : [],
    };

    const request = this.mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [messagePayload],
    });

    try {
      const result = await request;
      return result.body;
    } catch (err) {
      console.error('Error sending email:', err);
      throw err;
    }
  }

  async sendTransactionalEmail(
    to: string,
    templateId: number,
    variables: object,
    attachment?: AttachmentMail,
  ) {
    try {
      const messagePayload = {
        From: {
          Email: 'marketing@metacard.gift',
          Name: 'GiftAsso',
        },
        To: [
          {
            Email: to,
            Name: to,
          },
        ],
        TemplateID: templateId,
        TemplateLanguage: true,
        Variables: variables,
        Attachments: attachment ? [attachment] : [],
      };

      if (attachment) {
        this.logger.log(`Sending email with attachment: ${attachment.Filename} (${attachment.ContentType})`);
        this.logger.debug(`Attachment size: ${attachment.Base64Content.length} characters (base64)`);
      } else {
        this.logger.log('Sending email without attachment');
      }

      const request = this.mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [messagePayload],
      });
      
      const result = await request;
      this.logger.log(`Email sent successfully to ${to} with template ${templateId}`);
      return result.body;
    } catch (err) {
      this.logger.error('Error sending transactional email:', err);
      throw err;
    }
  }
}
