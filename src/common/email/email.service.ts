import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';

@Injectable()
export class EmailService {
  private oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
  );

  constructor() {
    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
  }

  async sendEmail(mailData: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    try {
      const accessToken = await this.oauth2Client.getAccessToken();

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GOOGLE_EMAIL,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
          accessToken: accessToken.token || '',
        },
      });

      const info = await transporter.sendMail({
        from: mailData.from,
        to: mailData.to,
        subject: mailData.subject,
        text: mailData.text,
        html: mailData.html,
      });

      console.log('Email sent:', info.messageId);
    } catch (error) {
      console.error('Email error:', error);
      throw error;
    }
  }
}
