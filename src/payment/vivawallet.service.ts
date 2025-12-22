import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface VivaWalletConfig {
  merchantId: string;
  merchantKey: string;
  sourceCode: number;
  apiKey: string;
  apiSecret: string;
  endpoints: {
    token: string;
    order: string;
    transaction: string;
  };
}

@Injectable()
export class VivaWalletService {
  private vivaWalletConfig: VivaWalletConfig;
  private readonly logger = new Logger(VivaWalletService.name);
  public DEFAULT_LOCALE = 'FR';
  public TRANSACTION_STATUS_SUCCESS = 'F';
  constructor() {
    this.vivaWalletConfig = {
      merchantId: process.env.VIVA_MERCHANT_ID,
      merchantKey: process.env.VIVA_MERCHANT_KEY,
      sourceCode: Number(process.env.VIVA_SOURCE_CODE),
      apiKey: process.env.VIVA_API_KEY,
      apiSecret: process.env.VIVA_API_SECRET,
      endpoints: {
        token: process.env.VIVA_TOKEN_URL,
        order: process.env.VIVA_ORDER_URL,
        transaction: process.env.VIVA_TRANSACTION_URL,
      },
    };
  }

  public async getAccessToken(): Promise<string> {
    try {
      const response = await axios.post(
        this.vivaWalletConfig.endpoints.token,
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${btoa(
              `${this.vivaWalletConfig.apiKey}:${this.vivaWalletConfig.apiSecret}`,
            )}`,
          },
          timeout: 1500,
        },
      );
      return response?.data?.access_token;
    } catch (e) {
      this.logger.error(e);
    }
  }

  public async createPaymentOrder(params: {
    amount: number;
    productName: string;
    customerTrns: string;
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
    locale: string;
  }): Promise<number> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await axios.post(
        this.vivaWalletConfig.endpoints.order,
        {
          amount: params.amount,
          sourceCode: this.vivaWalletConfig.sourceCode,
          merchantTrns: params.productName,
          customerTrns: params.customerTrns,
          customer: {
            fullName: `${params.firstname} ${params.lastname}`,
            email: params.email,
            phone: params?.phone,
            countryCode: params.locale,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      return response?.data?.orderCode;
    } catch (err) {
      this.logger.error(err);
    }
  }

  async getTransactionStatus(
    transactionId: string,
  ): Promise<{ statusId: string }> {
    try {
      const token = await this.getAccessToken();
      const Authorization = `Bearer ${token}`;

      const response = await axios.get(
        `${this.vivaWalletConfig.endpoints.transaction}/${transactionId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization,
          },
        },
      );

      return response?.data;
    } catch (err) {
      this.logger.error(err);
    }
  }
}
