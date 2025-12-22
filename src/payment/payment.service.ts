import { Injectable } from '@nestjs/common';
import { Order, PAYMENT_STATUS } from './entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { HttpService } from '@nestjs/axios';
import { UsersService } from '../users/users.service';
import { BundleItem } from '../products/types/products.interface';
import Stripe from 'stripe';
import { Logger } from '@nestjs/common';
import { InvoiceService } from '../invoice/invoice.service';
import { MailjetService } from '../common/mailjet/mailjet.service';
import { UploadService } from '../common/upload/upload.service';
import { ProductsService } from '../products/products.service';
import { StripeService } from './stripe.service';
import { SoldOutException } from '../common/exceptions/soldout.exception';
import { extname } from 'path';
import { In, MoreThanOrEqual, IsNull } from 'typeorm';
import { PaymentException } from '../common/exceptions/payment.exception';
import { ConfirmPaymentDto } from './dto/payment.dto';
import { TransactionsService } from '../transactions/transactions.service';
import { GenaiService } from '../genai/genai.service';
import { TranslatorService } from '../common/translator/translator.service';
import { OrderItem } from './entities/order.entity';
import { FEES, PLATFORM_FEE_PERCENTAGE } from '../common/constants';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly httpService: HttpService,
    private readonly userService: UsersService,
    private readonly invoiceService: InvoiceService,
    private readonly mailjetService: MailjetService,
    private readonly stripeService: StripeService,
    private readonly uploadService: UploadService,
    private readonly productsService: ProductsService,
    private readonly transactionsService: TransactionsService,
    private readonly genaiService: GenaiService,
    private readonly translatorService: TranslatorService,
  ) {}

  private getOrderItems(order: Order): OrderItem[] {
    return order.items || [];
  }

  private getTotalQuantity(items: OrderItem[]): number {
    return items.reduce((acc, item) => acc + item.quantity, 0);
  }

  private getTotalPrice(items: OrderItem[]): number {
    return items.reduce((acc, item) => acc + parseFloat(item.totalPrice), 0);
  }

  private isOnlyDigital(items: OrderItem[]): boolean {
    return items.every((item) => item.productType === 'digital');
  }

  private getFeeAmount(
    productType: 'magnet' | 'digital' | 'collector',
    product?: Product,
    itemTotalPrice?: number,
  ): number {
    // If product has custom commission settings, use those
    if (product?.commissionType && product?.commissionValue !== null && product?.commissionValue !== undefined) {
      if (product.commissionType === 'percentage' && itemTotalPrice) {
        // Calculate percentage-based commission
        return (itemTotalPrice * product.commissionValue) / 100;
      } else if (product.commissionType === 'fixed') {
        // Use fixed commission amount
        return product.commissionValue;
      }
    }

    // Default: Platform keeps 60%, association gets 40%
    if (itemTotalPrice) {
      return (itemTotalPrice * PLATFORM_FEE_PERCENTAGE) / 100;
    }

    // Legacy fallback for fixed fees (shouldn't be reached normally)
    return FEES[productType] || FEES.default;
  }

  async addVideoToOrder(orderId: string, videoUrl: string) {
    const order = await this.orderRepository.findOneOrFail({
      where: { reference: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return await this.orderRepository.save({
      ...order,
      iaThanksVideo: videoUrl,
    });
  }
  async createAccountLink(userId: number) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.stripeAccountId) {
      const account = await this.stripeService.createAccount(user.email);
      await this.userService.updateUser(user.id, {
        stripeAccountId: account.id,
      });
      user.stripeAccountId = account.id;
    }

    return await this.stripeService.createAccountLink(user.stripeAccountId);
  }

  async verifyPspAccount(userId: number) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const stripeAccount = await this.stripeService.getAccount(
      user.stripeAccountId,
    );

    await this.userService.updateUser(userId, {
      accountSetup: stripeAccount.details_submitted,
    });

    return { success: true, accountSetup: stripeAccount.details_submitted };
  }

  async generateIaVideo(paymentIntent: Order, user: User) {
    // Get the first product from items
    const items = this.getOrderItems(paymentIntent);
    if (!items.length) {
      throw new Error('No items found in order');
    }

    const firstItem = items[0];
    const product = await this.productsService.findOne(
      parseInt(firstItem.productId),
      ['campaign', 'campaign.user'],
    );

    if (!product?.campaign?.user?.id) {
      throw new Error('Product or campaign not found');
    }

    const association = await this.userService.findOne(
      product.campaign.user.id,
    );

    const iaVideo = await this.httpService.axiosRef.post(
      `${process.env.IA_VIDEO_API_URL}/send-video`,
      {
        templateVideoId: product.thanksVideoIaId,
        email: user.email,
        name: user.name,
        purchaseId: paymentIntent.reference,
        associationName: association.name_association,
        associationId: association.id,
      },
    );

    return iaVideo.data;
  }

  async createPayment(payment: Partial<Order>): Promise<number> {
    payment.reference = uuidv4();
    const paymentEntity = this.orderRepository.create(payment);
    await this.orderRepository.save(paymentEntity);
    return paymentEntity?.id;
  }

  async ensureStripeCustomer(user: User): Promise<string> {
    if (!user?.stripeCustomerId) {
      const customer = await this.stripeService.createCustomer(
        user.email,
        user.name,
        '',
      );
      await this.userService.updateUser(user.id, {
        stripeCustomerId: customer.id,
      });
      return customer.id;
    }
    return user.stripeCustomerId;
  }

  async handleVideoUpload(file?: Express.Multer.File): Promise<string> {
    if (!file) return '';

    return this.uploadService.uploadFile(file.buffer, {
      ContentType: file.mimetype,
      Key: `uploads/videos/${file.fieldname}-${Date.now()}${extname(file.originalname)}`,
    });
  }

  async validateProductAvailability(
    productId: number,
    items: Array<{ quantity: number }>,
  ): Promise<void> {
    const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);
    const countProductLeft = await this.productsService.countUserProduct({
      userId: IsNull(),
      productId,
    });

    if (countProductLeft < totalQuantity) {
      throw new SoldOutException();
    }
  }

  async createStripeSession(
    customerId: string | undefined,
    product: Product,
    bundle: BundleItem[],
  ) {
    if (!product?.campaign?.user?.id) {
      throw new Error('Product campaign user not found');
    }

    const user = await this.userService.findOne(product.campaign.user.id);
    const accountId = user?.stripeAccountId;

    const ALLOWED_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
      ['FR', 'BE', 'NL', 'LU', 'DE', 'IT', 'ES', 'PT', 'GB'];

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card', 'bancontact', 'ideal'],
      line_items: await this.generateLineItems(bundle, product),
      mode: 'payment',
      metadata: {
        association_id: product.campaign.user.id,
        association_name: product.campaign.user.name,
        card_id: product.id,
        campaign_id: product.campaign.id,
      },
      shipping_address_collection: {
        allowed_countries: ALLOWED_COUNTRIES,
      },
      success_url: `${process.env.FRONT_URL}/payment/check?s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONT_URL}/cancel`,
      customer: customerId || undefined,
      customer_creation: customerId ? undefined : 'always',
    };

    // Only add payment_intent_data with transfer_data if accountId exists
    if (accountId && user?.accountSetup) {
      sessionParams.payment_intent_data = {
        application_fee_amount: Math.round(
          bundle.reduce((total, item) => {
            const itemTotal = item.unitPrice * item.quantity;
            const feeAmount = this.getFeeAmount(item.productType, product, itemTotal);
            return total + feeAmount * item.quantity;
          }, 0) * 100,
        ),
        transfer_data: {
          destination: accountId,
        },
      };
    }

    return await this.stripeService.createCheckoutSession(sessionParams);
  }

  async sendOrderConfirmation(
    invoiceId: string | undefined,
    user: {
      email: string;
      name: string;
      lastname: string;
    },
    paymentIntentId: number,
    shopName: string,
    isOnlyDigital: boolean,
  ): Promise<void> {
    try {
      let dataAttachment = null;
      
      if (invoiceId) {
        try {
          await this.invoiceService.changeInvoiceState(invoiceId);
          
          // Add a small delay to ensure invoice is finalized
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          dataAttachment = await this.invoiceService.fetchInvoice(invoiceId);
          
          if (dataAttachment && dataAttachment.url) {
            await this.updatePayment(paymentIntentId, {
              invoiceUrl: dataAttachment.url,
            });
          } else {
            this.logger.warn(`Failed to fetch invoice data for invoiceId: ${invoiceId}`);
          }
        } catch (invoiceError) {
          this.logger.error(`Error processing invoice ${invoiceId}:`, invoiceError);
        }
      }
      
      const isPhysical = !isOnlyDigital;

      const payload: any = {
        firstname: user.name,
        lastname: user.lastname,
        email: user.email,
        order_name: paymentIntentId,
        shop_name: shopName,
        showDeliveryTime: isPhysical,
      };

      const attachment = dataAttachment && dataAttachment.buffer && dataAttachment.contentType
        ? {
            ContentType: dataAttachment.contentType,
            Filename: 'invoice.pdf',
            Base64Content: dataAttachment.buffer.toString('base64'),
          }
        : null;

      if (attachment) {
        this.logger.log(`Sending email with invoice attachment for order ${paymentIntentId}`);
      } else {
        this.logger.warn(`No invoice attachment available for order ${paymentIntentId}`);
      }

      await this.mailjetService.sendTransactionalEmail(
        user.email,
        this.mailjetService.TEMPLATE_ID_BY_SERVICE['VALIDATE_PAYMENT'],
        payload,
        attachment,
      );
    } catch (e) {
      this.logger.error('Error in sendOrderConfirmation:', e);
    }
  }

  async updatePayment(id: number, payment: Partial<Order>) {
    await this.orderRepository.update(id, payment);
  }

  async findOrdersByUserEmail(email: string): Promise<Order[]> {
    const stripePayments =
      await this.stripeService.findPaidPaymentsByEmail(email);

    if (!stripePayments.length) return [];

    const paymentIntentIds = stripePayments.map((p) => p.id);

    const orders = await this.orderRepository.find({
      where: {
        paymentIntentId: In(paymentIntentIds),
        status: PAYMENT_STATUS.SUCCEEDED,
        userId: IsNull(),
      },
      relations: [
        'userProducts',
        'userProducts.product',
        'userProducts.product.campaign',
        'userProducts.product.campaign.user',
      ],
    });

    return orders;
  }

  async claimProduct({ userId, email }: { userId?: number; email?: string }) {
    if (!userId && !email) {
      throw new Error('userId or email is required');
    }

    const user = userId
      ? await this.userService.findOne(userId)
      : await this.userService.findOneByEmail(email);

    if (!user) {
      return { success: false, claimed: [] };
    }

    const orders = await this.findOrdersByUserEmail(user.email);

    if (!orders || !orders.length) {
      return { success: true, claimed: [] };
    }

    const results = await Promise.all(
      orders.map(async (order) => {
        return this.claimProductForUser(order, user);
      }),
    );
    return { success: true, claimed: results };
  }

  async findOrderByReference(reference: string) {
    const order = await this.orderRepository.findOne({
      where: { reference },
      relations: ['user'],
    });

    if (!order) {
      return null;
    }

    // Get product info for all items in the order
    const items = this.getOrderItems(order);
    if (!items.length) {
      return order;
    }

    const products = await Promise.all(
      items.map((item) =>
        this.productsService.findOne(parseInt(item.productId), [
          'campaign',
          'campaign.user',
        ]),
      ),
    );

    const productsWithDetails = products
      .filter((product) => product?.campaign?.user)
      .map((product) => ({
        id: product.id,
        image: product.image,
        video_thanks: product.video_thanks,
        video_promo: product.video_promo,
        thanksVideoIaId: product.thanksVideoIaId,
        campaign: {
          user: {
            id: product.campaign.user.id,
            email: product.campaign.user.email,
            name_association: product.campaign.user.name_association,
          },
        },
      }));

    return {
      ...order,
      user: order.user,
      products: productsWithDetails,
    };
  }

  async findAPayment(
    options: Partial<Order>,
    relations?: string[],
  ): Promise<Order> {
    return await this.orderRepository.findOneOrFail({
      where: options,
      relations,
    });
  }

  async generateLineItems(
    bundle: BundleItem[],
    product: Product,
  ): Promise<Stripe.Checkout.SessionCreateParams.LineItem[]> {
    return bundle.map((item) => {
      // Apply promotion if valid
      const originalPrice = item.unitPrice;
      const discountedPrice = product.calculateDiscountedPrice(originalPrice);
      const unitAmount = Math.round(discountedPrice * 100);

      if (isNaN(unitAmount) || unitAmount <= 0) {
        throw new Error(
          `Invalid unit price for item ${item.id}: ${item.unitPrice}`,
        );
      }

      // Build product name with discount indicator if applicable
      let productName = product.name + ' - ' + item.id;
      const promotionSource = product.getPromotionSource();

      if (promotionSource === 'product' && product.isPromotionValid()) {
        const discountAmount = product.getDiscountAmount(originalPrice);
        if (product.promotionType === 'percentage') {
          productName += ` (${product.promotionValue}% off)`;
        } else {
          productName += ` (-${discountAmount.toFixed(2)}€)`;
        }
      } else if (promotionSource === 'campaign' && product.campaign?.isPromotionValid()) {
        const discountAmount = product.getDiscountAmount(originalPrice);
        if (product.campaign.promotionType === 'percentage') {
          productName += ` (${product.campaign.promotionValue}% off)`;
        } else {
          productName += ` (-${discountAmount.toFixed(2)}€)`;
        }
      }

      return {
        price_data: {
          currency: product.currency,
          product_data: {
            name: productName,
            images: [product.image],
          },
          unit_amount: unitAmount,
        },
        quantity: item.quantity,
      };
    });
  }

  async handleSuccessfulPayment(
    paymentIntent: Order,
    confirmPayment: Stripe.Checkout.Session,
    isAuth?: boolean,
  ) {
    const customerName = confirmPayment?.customer_details?.name || '';
    const nameParts = customerName.split(' ');
    const firstname = paymentIntent?.user?.name || nameParts[0] || '';
    const lastname =
      paymentIntent?.user?.lastname || nameParts.slice(1).join(' ') || '';

    const userDetails = {
      email:
        paymentIntent?.user?.email ?? confirmPayment?.customer_details?.email,
      name: firstname,
      lastname: lastname,
    };

    const invoiceInformation = {
      address: confirmPayment?.customer_details?.address?.line1,
      addressInformation: confirmPayment?.customer_details?.address?.line2,
      zipcode: confirmPayment?.customer_details?.address?.postal_code,
      city: confirmPayment?.customer_details?.address?.city,
      country: confirmPayment?.customer_details?.address?.country,
      phoneNumber: confirmPayment?.customer_details?.phone,
    };

    const bundlesForInvoice = this.getOrderItems(paymentIntent).map((item) => ({
      id: item.productType,
      quantity: item.quantity,
      price: parseFloat(item.unitPrice),
      unitPrice: parseFloat(item.unitPrice),
      productType: item.productType,
    }));

    const dataInvoice = await this.invoiceService.createInvoice(
      userDetails,
      bundlesForInvoice,
      invoiceInformation,
    );

    await this.updatePayment(paymentIntent.id, {
      paymentIntentId: confirmPayment?.payment_intent.toString(),
      status: PAYMENT_STATUS.SUCCEEDED,
      chargeId: '',
      firstname: userDetails.name,
      lastname: userDetails.lastname,
      invoice_address: confirmPayment?.customer_details?.address?.line1,
      invoice_address_information:
        confirmPayment?.customer_details?.address?.line2,
      invoice_city: confirmPayment?.customer_details?.address?.city,
      invoice_postalcode:
        confirmPayment?.customer_details?.address?.postal_code,
      invoice_country: confirmPayment?.customer_details?.address?.country,
      invoice_state: confirmPayment?.customer_details?.address?.state,
      invoice_phone: confirmPayment?.customer_details?.phone,
      delivery_address:
        confirmPayment?.collected_information?.shipping_details?.address?.line1,
      delivery_address_information:
        confirmPayment?.collected_information?.shipping_details?.address?.line2,
      delivery_city:
        confirmPayment?.collected_information?.shipping_details?.address?.city,
      delivery_postalcode:
        confirmPayment?.collected_information?.shipping_details?.address
          ?.postal_code,
      delivery_country:
        confirmPayment?.collected_information?.shipping_details?.address
          ?.country,
      delivery_state:
        confirmPayment?.collected_information?.shipping_details?.address?.state,
      delivery_phone: '',
      invoiceId: dataInvoice?.invoice?.id,
    });
    const items = this.getOrderItems(paymentIntent);

    const isOnlyDigital = this.isOnlyDigital(items);

    // Get all products with their association info
    const products = await Promise.all(
      items.map((item) =>
        this.productsService.findOne(parseInt(item.productId), [
          'campaign',
          'campaign.user',
        ]),
      ),
    );

    if (products.length === 0) {
      throw new Error('No products found in order');
    }

    // Group items by association and calculate amounts for each
    const associationTransactions = new Map<
      number,
      { amount: number; fees: number; netAmount: number }
    >();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const product = products[i];

      if (!product?.campaign?.user?.id) {
        this.logger.error('Product campaign user not found', {
          productId: product?.id,
          itemIndex: i,
        });
        continue;
      }

      const associationId = product.campaign.user.id;
      const itemTotal = parseFloat(item.totalPrice);
      const feeAmount = this.getFeeAmount(item.productType, product, itemTotal);
      const itemFees = feeAmount; // feeAmount already calculated on totalPrice which includes quantity
      const itemNet = itemTotal - itemFees;

      if (associationTransactions.has(associationId)) {
        const existing = associationTransactions.get(associationId);
        associationTransactions.set(associationId, {
          amount: existing.amount + itemTotal,
          fees: existing.fees + itemFees,
          netAmount: existing.netAmount + itemNet,
        });
      } else {
        associationTransactions.set(associationId, {
          amount: itemTotal,
          fees: itemFees,
          netAmount: itemNet,
        });
      }
    }

    // Create a transaction for each association
    const transactionPromises = [];
    for (const [
      associationId,
      transactionData,
    ] of associationTransactions.entries()) {
      transactionPromises.push(
        this.transactionsService.createTransaction({
          orderId: paymentIntent.id,
          amount: transactionData.amount,
          fees: transactionData.fees,
          netAmount: transactionData.netAmount,
          associationId: associationId,
          status: 'completed',
        }),
      );
    }

    await Promise.all(transactionPromises);

    await this.sendOrderConfirmation(
      dataInvoice.invoice.id,
      userDetails,
      paymentIntent.id,
      products[0]?.campaign?.campagne_name || 'Unknown Campaign',
      isOnlyDigital,
    );

    const PAYMENT_CONFIRMATION_TEMPLATE_ID =
      await this.mailjetService.TEMPLATE_ID_BY_SERVICE['CREATE_ACCOUNT'];

    if (!isAuth) {
      this.mailjetService.sendTransactionalEmail(
        confirmPayment?.customer_details?.email,
        PAYMENT_CONFIRMATION_TEMPLATE_ID,
        {
          account_creation_link: `${process.env.FRONT_URL}/auth/sign-up?reference=${paymentIntent.reference}`,
          firstname: userDetails.name ?? '',
          lastname: userDetails.lastname ?? '',
          shop_name: 'Giftasso',
        },
      );
    }

    return paymentIntent;
  }

  async claimProductForUser(paymentIntent: Order, user: User) {
    const items = this.getOrderItems(paymentIntent);
    const userProducts = [];

    for (const item of items) {
      const product = await this.productsService.findOne(
        parseInt(item.productId),
      );
      
      if (!product) {
        this.logger.error('Product not found', { productId: item.productId });
        continue;
      }
      
      const itemUserProducts = await this.productsService.findUserProducts(
        {
          userId: IsNull(),
          productId: product.id,
        },
        item.quantity,
      );
      userProducts.push(...itemUserProducts);
    }

    if (userProducts.length > 0) {
      await this.productsService.updateUserProducts(
        userProducts.map((e) => e.id),
        {
          order: paymentIntent,
          userId: user.id,
        },
      );
    }

    await this.updatePayment(paymentIntent.id, {
      user,
    });

    // Send confirmation email to admin to handle physical products
    await this.sendEmailToAdmin(paymentIntent);

    // Handle affiliates
    await this.handleAffiliates(paymentIntent, user);

    // Handle AI video if needed
    for (const item of items) {
      const product = await this.productsService.findOne(
        parseInt(item.productId),
      );
      if (product?.thanksVideoIaId && user.name) {
        try {
          await this.generateIaVideo(paymentIntent, user);
        } catch (error) {
          this.logger.error('Failed to generate IA video', {
            orderId: paymentIntent.id,
            productId: item.productId,
            error: error.message,
          });
        }
      }
    }

    return { success: true, items };
  }

  private async sendEmailToAdmin(paymentIntent: Order) {
    const items = this.getOrderItems(paymentIntent);

    if (!this.isOnlyDigital(items)) {
      // Get first product for campaign info (all items should belong to same campaign)
      const firstItem = items[0];
      const product = await this.productsService.findOne(
        parseInt(firstItem.productId),
        ['campaign', 'campaign.user'],
      );

      if (!product?.campaign?.user) {
        this.logger.error('Product or campaign user not found for order', {
          orderId: paymentIntent.id,
          productId: firstItem.productId,
        });
        return;
      }

      const isProduction = process.env.NODE_ENV === 'production';
      const orderLinkAdmin = isProduction
        ? 'https://admin.giftasso.com/orders'
        : 'https://admin-staging.giftasso.com/orders';
      const orderLinkUser = isProduction
        ? 'https://giftasso.com/dashboard/orders'
        : 'https://staging.giftasso.com/dashboard/orders';

      const recipientEmail = product.campaign.handleDistribution
        ? product.campaign.user.email
        : 'antoine@giftasso.com';

      const orderLink = product.campaign.handleDistribution
        ? orderLinkUser
        : orderLinkAdmin;

      const shippingAddress = [
        paymentIntent.delivery_address,
        paymentIntent.delivery_city,
        paymentIntent.delivery_postalcode,
        paymentIntent.delivery_country,
      ].join(' ');

      const TEMPLATE_ID =
        await this.mailjetService.TEMPLATE_ID_BY_SERVICE[
          'ADMIN_PAYMENT_CONFIRMATION'
        ];

      try {
        await this.mailjetService.sendTransactionalEmail(
          recipientEmail,
          TEMPLATE_ID,
          {
            order_link: orderLink,
            shipping_address: shippingAddress,
            order_total: paymentIntent.price,
            customer_email: paymentIntent.user?.email,
            customer_name: paymentIntent.user?.name,
            order_id: paymentIntent.id,
            shop_name: product.campaign.user.name_association,
          },
        );
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  private async handleAffiliates(paymentIntent: Order, user: User) {
    const items = this.getOrderItems(paymentIntent);
    const products = await Promise.all(
      items.map((item) =>
        this.productsService.findOne(parseInt(item.productId), [
          'campaign',
          'campaign.user',
        ]),
      ),
    );

    const productsWithCampaign = products.filter(
      (p) => p && p.campaign && p.campaign.user,
    );
    if (!productsWithCampaign.length) return;

    const affiliatedUserIds = [
      ...productsWithCampaign.map((p) => p.campaign.user.id),
      user.id,
    ];

    // Find active affiliations: either permanent (null expiry) or not yet expired
    const affiliated = await this.userService.findUserAffiliations([
      // Permanent affiliations (for associations)
      { affiliatedUserId: In(affiliatedUserIds), expiredAt: IsNull() },
      // Non-expired affiliations (for donors)
      { affiliatedUserId: In(affiliatedUserIds), expiredAt: MoreThanOrEqual(new Date()) },
    ]);

    if (affiliated.length) {
      // Calculate platform profit (fees) - this is what affiliate commission is based on
      const totalPlatformProfit = items.reduce((acc, item, index) => {
        const product = products[index];
        const itemTotal = parseFloat(item.totalPrice);
        const feeAmount = this.getFeeAmount(item.productType, product, itemTotal);
        return acc + feeAmount; // Platform profit = fees
      }, 0);

      const userTransactions = affiliated.map((affiliate) => ({
        userAffiliationId: affiliate.id,
        // Convert to cents: platformProfit (euros) * percentage * 100
        amount: Math.round(totalPlatformProfit * (affiliate.earningPercentage / 100) * 100),
        orderId: paymentIntent.id,
      }));

      await this.userService.createUserBulkTransaction(userTransactions);
      await this.sendAffiliateEmails(affiliated, productsWithCampaign);
    }
  }

  private async sendAffiliateEmails(affiliated: any[], products: Product[]) {
    const emailPromises = [];

    for (const affiliate of affiliated) {
      for (const product of products) {
        emailPromises.push(
          this.mailjetService.sendTransactionalEmail(
            affiliate.affiliatedUser.email,
            this.mailjetService.TEMPLATE_ID_BY_SERVICE['AFFILIATED_CARD'],
            {
              card_link: `${process.env.FRONT_URL}/card/${product.slug}`,
              card_name: product.name,
              association_name: product.campaign.user?.name_association,
              lastname: '',
              firstname: affiliate.affiliatedUser?.name || '',
            },
          ),
        );
      }
    }

    return Promise.all(emailPromises).catch((e) => this.logger.error(e));
  }

  async handleStripeConfirmation(
    confirmPaymentDto: ConfirmPaymentDto,
    paymentIntent: Order,
  ) {
    let confirmPayment: Stripe.PaymentIntent | Stripe.Checkout.Session = null;
    if (confirmPaymentDto.paymentMethodId) {
      confirmPayment = await this.stripeService.confirmPaymentIntent(
        paymentIntent.paymentIntentId,
        confirmPaymentDto.paymentMethodId,
        `${process.env.FRONT_URL}/congrats?reference=${paymentIntent.reference}`,
      );
    } else {
      confirmPayment = await this.stripeService.getPaymentSession(
        paymentIntent.paymentIntentId,
      );
      if (confirmPayment.status !== 'complete') {
        throw new PaymentException();
      }
    }

    return confirmPayment;
  }

  async handleRefund(paymentIntentId: string) {
    const order = await this.orderRepository.findOne({
      where: {
        paymentIntentId,
      },
      relations: [
        'userProducts',
        'userProducts.product',
        'userProducts.product.campaign',
        'userProducts.product.campaign.user',
      ],
    });

    if (!order) {
      throw new Error(`Order with payment intent ${paymentIntentId} not found`);
    }

    order.status = PAYMENT_STATUS.REFUNDED;
    await this.orderRepository.save(order);

    await this.invoiceService.changeInvoiceState(
      order.invoiceId,
      'canceled',
      'Refunded',
    );

    await this.updatePayment(order.id, {
      status: PAYMENT_STATUS.REFUNDED,
    });

    // Get all products with their association info
    const items = this.getOrderItems(order);
    const products = await Promise.all(
      items.map((item) =>
        this.productsService.findOne(parseInt(item.productId), [
          'campaign',
          'campaign.user',
        ]),
      ),
    );

    if (products.length === 0) {
      this.logger.error('No products found in order items', {
        orderId: order.id,
        paymentIntentId,
      });
      throw new Error('No products found for refund transaction');
    }

    const associationRefunds = new Map<
      number,
      { totalAmount: number; fees: number; netAmount: number }
    >();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const product = products[i];

      if (!product?.campaign?.user?.id) {
        this.logger.error('Product campaign user not found for refund', {
          productId: product?.id,
          itemIndex: i,
        });
        continue;
      }

      const associationId = product.campaign.user.id;
      const itemTotal = parseFloat(item.totalPrice);
      const feeAmount = this.getFeeAmount(item.productType, product, itemTotal);
      const itemFees = feeAmount; // feeAmount already calculated on totalPrice which includes quantity
      const itemNet = itemTotal - itemFees;

      if (associationRefunds.has(associationId)) {
        const existing = associationRefunds.get(associationId);
        associationRefunds.set(associationId, {
          totalAmount: existing.totalAmount + itemTotal,
          fees: existing.fees + itemFees,
          netAmount: existing.netAmount + itemNet,
        });
      } else {
        associationRefunds.set(associationId, {
          totalAmount: itemTotal,
          fees: itemFees,
          netAmount: itemNet,
        });
      }
    }

    const transactionPromises = [];
    for (const [associationId, refundData] of associationRefunds.entries()) {
      transactionPromises.push(
        this.transactionsService.createTransaction({
          orderId: order.id,
          amount: -refundData.totalAmount, // Full amount refunded to customer
          fees: -refundData.fees, // Fees are deducted from platform
          netAmount: -refundData.netAmount, // Only net amount deducted from association
          associationId: associationId,
          status: 'refunded',
        }),
      );
    }

    await Promise.all(transactionPromises);

    return this.orderRepository.findOne({
      where: { id: order.id },
      relations: [
        'userProducts',
        'userProducts.product',
        'userProducts.product.campaign',
        'userProducts.product.campaign.user',
      ],
    });
  }
}
