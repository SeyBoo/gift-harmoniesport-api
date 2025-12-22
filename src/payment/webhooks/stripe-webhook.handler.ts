import { Injectable, Logger } from '@nestjs/common';
import { StripeService } from '../stripe.service';
import { PaymentService } from '../payment.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { UsersService } from '../../users/users.service';
import Stripe from 'stripe';

@Injectable()
export class StripeWebhookHandler {
  private readonly logger = new Logger(StripeWebhookHandler.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentService: PaymentService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
  ) {}

  async handleWebhookEvent(payload: Buffer, signature: string): Promise<void> {
    try {
      const event = await this.stripeService.constructEventFromPayload(
        payload,
        signature,
      );

      this.logger.log(`Processing Stripe webhook event: ${event.type}`);

      switch (event.type) {
        case 'charge.refunded':
          await this.handleRefund(event.data.object);
          break;
        case 'payout.paid':
          await this.handlePayout(event.data.object);
          break;
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`);
      throw error;
    }
  }

  private async handleRefund(charge: Stripe.Charge): Promise<void> {
    const paymentIntentId = charge.payment_intent as string;
    this.logger.log(`Processing refund for payment intent: ${paymentIntentId}`);
    await this.paymentService.handleRefund(paymentIntentId);
  }

  private async handlePayout(payout: Stripe.Payout): Promise<void> {
    try {
      this.logger.log(`Processing payout: ${payout.id} for ${payout.destination}`);
      
      const accountId = payout.destination as string;
      
      const user = await this.usersService.findByStripeAccountId(accountId);
      
      if (!user) {
        this.logger.error(`No user found with Stripe account ID: ${accountId}`);
        return;
      }
      
      await this.transactionsService.createPayout({
        amount: payout.amount / 100,
        associationId: user.id,
      });
      
      this.logger.log(`Successfully processed payout for user ${user.id}`);
    } catch (error) {
      this.logger.error(`Error processing payout: ${error.message}`);
      throw error;
    }
  }
} 