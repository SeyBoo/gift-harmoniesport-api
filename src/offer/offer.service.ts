import { Injectable } from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { Offer } from './entity/offer.entity';
import { CreateOfferDto } from './dtos/createOffer.dto';
import { SendGridService } from '../common/sendgrid/sendgrid.service';
import * as crypto from 'crypto';
import { UserProduct } from '../products/entities/userproduct.entity';
import { User } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class OfferService {
  constructor(
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    private readonly sendGridService: SendGridService,
    @InjectRepository(UserProduct)
    private readonly productUserEntity: Repository<UserProduct>,
    @InjectRepository(User)
    private readonly userEntity: Repository<User>,
  ) {}

  async generateUniqueToken(): Promise<string> {
    while (true) {
      const token = crypto.randomBytes(32).toString('hex');
      const existing = await this.offerRepository.findOne({
        where: { verifyToken: token },
      });
      if (!existing) return token;
    }
  }

  async createOffer(createOfferDto: CreateOfferDto[]): Promise<Offer[]> {
    const offers: Partial<Offer>[] = await Promise.all(
      createOfferDto.map(async (dto) => ({
        verifyToken: await this.generateUniqueToken(),
        email: dto.email,
        product: { id: dto.productId } as any,
      })),
    );

    const savedOffers = await this.offerRepository.save(offers);

    return savedOffers;
  }

  private constructOfferLink(offer: Offer): string {
    const suffix = `?offer=${offer.verifyToken}&email=${offer.email}`;
    return `${process.env.FRONT_URL}/auth/sign-up${suffix}`;
  }

  private async sendOfferEmail(
    email: string,
    offerLink: string,
  ): Promise<void> {
    const emailData = {
      from: 'it@giftasso.com',
      to: email,
      subject: 'You have a new offer!',
      text: `You have received a new offer. Click here to view: ${offerLink}`,
      html: `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <title></title>
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style type="text/css">
        body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
        table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
        img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
        p { display:block;margin:13px 0; }
    </style>
</head>
<body style="word-spacing:normal;background-color:#f4f2fa;">
    <div style="background-color:#f4f2fa;">
        <div style="margin:0px auto;max-width:620px;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                <tr>
                    <td align="center" style="padding:40px 0px 20px 0px;">
                        <img alt="Logo" src="https://s4npg.mjt.lu/img2/s4npg/78df2bf2-f68b-45bd-9f51-d750c5f7977a/content" width="107">
                    </td>
                </tr>
            </table>
            <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;width:100%;border-radius:16px;">
                <tr>
                    <td align="center" style="padding:30px 40px;">
                        <h1 style="font-family:Arial, sans-serif;color:#4A3AFF;font-size:28px;text-align:center;">You have a new offer!</h1>
                        <p style="font-family:Arial, sans-serif;color:#000000;font-size:18px;text-align:center;">Someone has sent you a gift on Giftasso!</p>
                        <p style="font-family:Arial, sans-serif;color:#000000;font-size:16px;text-align:center;">Click the button below to view and claim your offer:</p>
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px auto;">
                            <tr>
                                <td align="center" style="background:#4A3AFF;padding:12px 24px;border-radius:8px;">
                                    <a href="${offerLink}" style="color:#ffffff;font-family:Arial, sans-serif;font-size:16px;text-decoration:none;">View Offer</a>
                                </td>
                            </tr>
                        </table>
                        <p style="font-family:Arial, sans-serif;color:#000000;font-size:14px;text-align:center;">Create an account to claim your gift and access all your offers.</p>
                    </td>
                </tr>
            </table>
            <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                <tr>
                    <td align="center" style="padding:20px 26px;">
                        <p style="font-family:Arial, sans-serif;color:#726E85;font-size:13px;text-align:center;">Giftasso, www.giftasso.com<br>If you no longer wish to receive these emails, <a href="[[UNSUB_LINK_FR]]">unsubscribe here</a>.</p>
                    </td>
                </tr>
            </table>
        </div>
    </div>
</body>
</html>`,
    };
    await this.sendGridService.sendEmail(emailData);
  }

  private async markOfferAsSent(offerId: number): Promise<void> {
    await this.offerRepository.update(offerId, { sentAt: new Date() });
  }

  async sendOfferEmails() {
    const offers = await this.offerRepository.find({
      where: { sentAt: IsNull() },
    });

    const emailPromises = offers.map(async (offer) => {
      try {
        const user = await this.userEntity.findOne({
          where: { email: offer.email },
        });
        const offerLink = this.constructOfferLink(offer);

        if (user) {
          await this.claimOffer(offer.verifyToken, user.id);
        }

        await this.sendOfferEmail(offer.email, offerLink);
        await this.markOfferAsSent(offer.id);
      } catch (error) {
        console.error(`Failed to send email to ${offer.email}:`, error);
      }
    });

    await Promise.all(emailPromises);

    return {
      message: 'Emails sent successfully',
      success: true,
    };
  }

  async findByToken(token: string, email: string): Promise<Offer | null> {
    return this.offerRepository.findOne({
      where: { verifyToken: token, email: email },
      relations: ['product'],
    });
  }

  async claimOffer(token: string, userId: number): Promise<Offer> {
    const user = await this.userEntity.findOne({
      where: { id: userId },
    });

    const offer = await this.findByToken(token, user.email);

    if (!offer) {
      throw new Error('Invalid or expired offer token');
    }

    if (offer.claimedAt) {
      throw new Error('Offer has already been claimed');
    }

    await this.productUserEntity.save({
      userId,
      productId: offer.product.id,
      tokenId: '',
    });

    await this.offerRepository.update(offer.id, { claimedAt: new Date() });

    return offer;
  }
}
