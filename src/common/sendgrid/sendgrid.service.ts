import { Injectable } from '@nestjs/common';
import { MailDataRequired, ResponseError, ClientResponse } from '@sendgrid/mail';
import sgMail from '@sendgrid/mail';

@Injectable()
export class SendGridService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);
  }

  async sendEmail(mailData: MailDataRequired): Promise<void> {
    try {
      const [response]: [ClientResponse, object] = await sgMail.send({
        from: 'it@giftasso.com',
        ...mailData,
      });
      if (response.statusCode >= 400) {
        console.error('SendGrid error:', response);
        throw new Error(`SendGrid error: ${response.statusCode}`);
      }
    } catch (err) {
      const error = err as ResponseError;
      console.error('SendGrid error:', error);
      throw error;
    }
  }
}
