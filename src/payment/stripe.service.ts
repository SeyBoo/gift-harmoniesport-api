import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  async createCustomer(
    email: string,
    name: string,
    phone: string,
    address?: Stripe.Address,
  ): Promise<Stripe.Customer> {
    return await this.stripe.customers.create({
      email,
      name,
      address,
      phone,
    });
  }

  async createAccount(email: string): Promise<Stripe.Account> {
    return await this.stripe.accounts.create({
      type: 'express',
      country: 'FR',
      business_type: 'non_profit',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      email,
    });
  }

  async createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.create(params);
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    customerId: string,
    description: string,
  ): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      description,
      setup_future_usage: 'off_session',
      payment_method_types: ['card'],
    });
  }

  async confirmPaymentIntent(
    id: string,
    paymentMethod: string,
    returnUrl: string,
  ): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.confirm(id, {
      payment_method: paymentMethod,
      return_url: returnUrl,
    });
  }

  async getPaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.retrieve(id);
  }

  async getPaymentSession(id: string): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.retrieve(id);
  }

  async getAccount(id: string): Promise<Stripe.Account> {
    return await this.stripe.accounts.retrieve(id);
  }

  async createAccountLink(
    accountId: string,
  ): Promise<Stripe.Response<Stripe.AccountLink>> {
    return await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONT_URL}/admin/stripe/setup`,
      return_url: `${process.env.FRONT_URL}/admin/stripe/verify`,
      type: 'account_onboarding',
    });
  }

  async findPaidPaymentsByEmail(
    email: string,
  ): Promise<Stripe.PaymentIntent[]> {
    const customers = await this.stripe.customers.list({
      email: email,
      limit: 100,
    });

    if (customers.data.length === 0) {
      return [];
    }

    const results = await Promise.all(
      customers.data.map(async (customer) => {
        const paymentIntents = await this.stripe.paymentIntents.list({
          customer: customer.id,
          limit: 100,
        });

        return paymentIntents.data.filter((pi) => pi.status === 'succeeded');
      }),
    );

    return results.flat();
  }

  async constructEventFromPayload(
    payload: Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  }

  async refundPayment(paymentIntentId: string): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({
      payment_intent: paymentIntentId,
    });
  }
}
