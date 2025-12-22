import {
  Body,
  Controller,
  NotFoundException,
  Post,
  Get,
  Request,
  UseGuards,
  Param,
  UploadedFile,
  Logger,
  UseInterceptors,
  Put,
  RawBodyRequest,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfirmPaymentDto, CreatePaymentIntentDto } from './dto/payment.dto';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentService } from './payment.service';
import { PAYMENT_STATUS, PSP_PROVIDER_NAME } from './entities/order.entity';
import { Public } from '../common/decorators';
import { Express } from 'express';
import { VivaWalletService } from './vivawallet.service';
import { TranslatorService } from '../common/translator/translator.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BundleItem } from '../products/types/products.interface';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';
import { StripeWebhookHandler } from './webhooks/stripe-webhook.handler';

@Controller('order')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);
  constructor(
    private readonly productsService: ProductsService,
    private readonly userService: UsersService,
    private readonly vivaWalletService: VivaWalletService,
    private readonly paymentService: PaymentService,
    private readonly translatorService: TranslatorService,
    private readonly stripeService: StripeService,
    private readonly stripeWebhookHandler: StripeWebhookHandler,
  ) {}

  @Public()
  @Get('byreference/:reference')
  async findOrderByReference(@Param('reference') reference: string) {
    const rep = await this.paymentService.findOrderByReference(reference);
    return rep;
  }

  @UseGuards(JwtAuthGuard)
  @Get('psp/token')
  async getPspAccessToken() {
    return {
      success: true,
      accessToken: await this.vivaWalletService.getAccessToken(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('psp/account-link')
  async createAccountLink(@Request() req) {
    return await this.paymentService.createAccountLink(parseInt(req.user.id));
  }

  @UseGuards(JwtAuthGuard)
  @Put('psp/verify')
  async verifyPdp(@Request() req) {
    return await this.paymentService.verifyPspAccount(parseInt(req.user.id));
  }

  @Post('/payment-intent')
  @UseInterceptors(
    FileInterceptor('video', {
      storage: memoryStorage(),
    }),
  )
  @UseGuards(OptionalJwtAuthGuard)
  async createPaymentIntent(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() paymentDto: CreatePaymentIntentDto,
  ) {
    const bundle: BundleItem[] = JSON.parse(paymentDto.bundle);

    const productIds = [...new Set(bundle.map((item) => item.id))];

    /*     for (const productId of productIds) {
      const productItems = bundle
        .filter((item) => item.id === productId)
        .map((item) => ({ quantity: item.quantity }));

      await this.paymentService.validateProductAvailability(
        parseInt(productId),
        productItems,
      );
    } */

    const mainProduct = await this.productsService.findOne(
      parseInt(productIds[0]),
      ['campaign', 'campaign.user'],
    );

    let customerId;

    if (req?.user?.id) {
      const user = await this.userService.findOne(req.user.id);
      customerId = await this.paymentService.ensureStripeCustomer(user);
    }

    const session = await this.paymentService.createStripeSession(
      customerId,
      mainProduct,
      bundle,
    );

    const video = await this.paymentService.handleVideoUpload(file);

    // Load all products to apply correct promotions per product
    const productsMap = new Map();
    for (const productId of productIds) {
      const product = await this.productsService.findOne(
        parseInt(productId),
        ['campaign', 'campaign.user'],
      );
      productsMap.set(productId, product);
    }

    // Apply promotions to calculate final prices
    const orderItems = bundle.map((item) => {
      const product = productsMap.get(item.id) || mainProduct;
      const discountedUnitPrice = product.calculateDiscountedPrice(item.unitPrice);
      const totalPrice = discountedUnitPrice * item.quantity;

      return {
        productId: item.id,
        quantity: item.quantity,
        unitPrice: discountedUnitPrice.toString(),
        totalPrice: totalPrice.toString(),
        productType: item.productType,
      };
    });

    const total = orderItems.reduce(
      (acc, item) => acc + parseFloat(item.totalPrice),
      0,
    );

    await this.paymentService.createPayment({
      paymentIntentId: session.id,
      status: PAYMENT_STATUS.INTENDED,
      pspProviderName: PSP_PROVIDER_NAME.STRIPE,
      userId: req?.user?.id,
      message: paymentDto.message,
      multilingualMessage: paymentDto.message
        ? await this.translatorService.translateAll(paymentDto.message)
        : undefined,
      video,
      items: orderItems,
      price: total.toString(),
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  @Post('/confirm-payment')
  @UseGuards(OptionalJwtAuthGuard)
  async confirmPayment(
    @Request() req,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
  ) {
    try {
      const paymentIntent = await this.paymentService.findAPayment(
        {
          status: PAYMENT_STATUS.INTENDED,
          paymentIntentId: confirmPaymentDto.paymentIntentId,
        },
        ['user'],
      );
      if (!paymentIntent) {
        throw new NotFoundException();
      }

      if (!paymentIntent.items || paymentIntent.items.length === 0) {
        throw new NotFoundException('No items found in payment');
      }

      // Get unique product IDs from items and validate all products
      const productIds = [
        ...new Set(paymentIntent.items.map((item) => parseInt(item.productId))),
      ];

      /*       for (const productId of productIds) {
        const productItems = paymentIntent.items
          .filter(item => parseInt(item.productId) === productId)
          .map(item => ({ quantity: item.quantity }));
          
        await this.paymentService.validateProductAvailability(
          productId,
          productItems,
        );
      } */

      // Get the main product for response (first product)
      const mainProduct = await this.productsService.findOne(productIds[0], [
        'campaign',
        'campaign.user',
      ]);

      const confirmPayment = await this.paymentService.handleStripeConfirmation(
        confirmPaymentDto,
        paymentIntent,
      );

      // Handle successful payment
      const updatedPayment = await this.paymentService.handleSuccessfulPayment(
        paymentIntent,
        confirmPayment as Stripe.Checkout.Session,
        !!req?.user?.id,
      );

      // If user is authenticated, claim the product immediately
      if (req?.user?.id) {
        const user = await this.userService.findOne(req.user.id);

        await this.paymentService.claimProductForUser(updatedPayment, user);
      }

      if (!req?.user?.id) {
        const email = (confirmPayment as Stripe.Checkout.Session)
          .customer_details.email;
        await this.paymentService.claimProduct({
          email,
        });
      }

      return {
        success: true,
        product: mainProduct,
        reference: paymentIntent.reference,
        items: paymentIntent.items,
      };
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  @Post('/claim-product')
  @UseGuards(JwtAuthGuard)
  async claimProduct(@Request() req) {
    return await this.paymentService.claimProduct(req.user.id);
  }

  @Put('/video/:id')
  async addVideoToOrder(
    @Param('id') id: string,
    @Body() body: { videoUrl: string },
  ) {
    const data = await this.paymentService.addVideoToOrder(id, body.videoUrl);
    return {
      success: true,
      data,
    };
  }

  @Public()
  @Post('/webhook/stripe')
  async handleStripeWebhook(
    @Request() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      const payload = req.rawBody;

      if (!payload || !signature) {
        throw new HttpException(
          'Missing payload or signature',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.stripeWebhookHandler.handleWebhookEvent(payload, signature);
      return { received: true };
    } catch (err) {
      this.logger.error(`Webhook Error: ${err.message}`);
      throw new HttpException(
        `Webhook Error: ${err.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
