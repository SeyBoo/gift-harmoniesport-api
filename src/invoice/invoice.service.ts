import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import dayjs from 'dayjs';
import { sleep } from '../common/utils';
import { UploadService } from '../common/upload/upload.service';
import { BundleItemWithPrice } from '../products/types/products.interface';
import { countries } from 'countries-list';

interface InvoiceInformation {
  address: string;
  addressInformation?: string;
  zipcode: string;
  city: string;
  country: string;
  phoneNumber: string;
}
@Injectable()
export class InvoiceService {
  private readonly invoiceProvider = 'invoiceexpress';
  private apiKey: string;
  private apiAccountName: string;
  private readonly logger = new Logger(InvoiceService.name);
  private readonly vatRate = 23.0;

  constructor(private readonly uploadService: UploadService) {
    this.apiKey = process.env.INVOICE_API_KEY;
    this.apiAccountName = process.env.INVOICE_API_ACCOUNT_NAME;
  }

  private getCountryName(countryCode: string): string {
    // If it's already a full country name, return it
    if (countryCode.length > 2) {
      return countryCode;
    }

    // Convert from ISO code to full name
    const country = countries[countryCode.toUpperCase()];
    return country ? country.name : 'France'; // Default to France if not found
  }

  private calculateNetAmount(ttcPrice: number, vatRate: number): number {
    // Calculate HT from TTC: HT = TTC / (1 + VAT_RATE/100)
    return Math.round((ttcPrice / (1 + vatRate / 100)) * 100) / 100;
  }

  private calculateVatAmount(ttcPrice: number, vatRate: number): number {
    // Calculate VAT amount from TTC: VAT = TTC - HT
    const netAmount = this.calculateNetAmount(ttcPrice, vatRate);
    return Math.round((ttcPrice - netAmount) * 100) / 100;
  }

  public async createInvoice(
    userDetails: {
      email: string;
      name: string;
      lastname: string;
    },
    bundles: BundleItemWithPrice[],
    invoiceInformation: InvoiceInformation,
  ): Promise<{ invoice: { id: string; status: string } }> {
    try {
      const name = userDetails.lastname
        ? `${userDetails.name} ${userDetails.lastname}`
        : userDetails.name;

      const countryName = this.getCountryName(invoiceInformation.country);

      // Ensure items are properly formatted
      const items = bundles.map((bundle) => {
        const price = parseFloat(bundle.price as unknown as string);

        if (isNaN(price)) {
          throw new Error(`Invalid price for bundle ${bundle.id}`);
        }

        const netAmount = this.calculateNetAmount(price, this.vatRate);

        return {
          name: `Card - ${bundle.id}`,
          description: bundle.id,
          unit_price: netAmount, // Use HT (net amount) as unit price
          quantity: parseInt(bundle.quantity.toString(), 10),
          tax: {
            name: "IVA23" // Use 23% VAT rate for Portugal
          }
        };
      });



      const payload = {
        invoice: {
          date: dayjs().format('YYYY-MM-DD'),
          due_date: dayjs().format('YYYY-MM-DD'),
          reference: `${process.env.NODE_ENV === 'dev' ? 'DEV_' : ''}${Date.now()}`,
          currency_code: 'EUR',
          client: {
            name: name || 'Anonymous',
            email: userDetails.email,
            address: invoiceInformation.address || 'N/A',
            city: invoiceInformation.city || 'N/A',
            country: countryName,
            postal_code: invoiceInformation.zipcode || 'N/A',
            phone: invoiceInformation.phoneNumber || undefined,
          },
          items: items,
        },
      };

      this.logger.debug('Invoice payload:', payload); // Log the payload for debugging

      const response = await axios.post(
        `https://${this.apiAccountName}.app.invoicexpress.com/invoices.json?api_key=${this.apiKey}`,
        payload,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (e) {
      this.logger.error('Invoice creation failed:', {
        status: e.response?.status,
        data: e.response?.data,
        message: e.message,
      });
      throw e; // Re-throw to handle in the payment service
    }
  }

  public async changeInvoiceState(
    documentId: string,
    state = 'finalized',
    message?: string,
  ) {
    try {
      if (process.env.NODE_ENV === 'dev') {
        return;
      }

      const response = await axios.request({
        method: 'PUT',
        url: `https://${this.apiAccountName}.app.invoicexpress.com/invoices/${documentId}/change-state.json?api_key=${this.apiKey}`,
        data: JSON.stringify({
          invoice: {
            state,
            message,
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response?.data;
    } catch (e) {
      this.logger.error(e);
    }
    return null;
  }

  public async fetchInvoice(
    documentId: string,
    retryCount = 1,
    maxRetries = 2,
  ): Promise<{ url: string; buffer: Buffer; contentType: string } | null> {
    try {
      this.logger.log(`Fetching invoice PDF for documentId: ${documentId}`);
      
      const response = await axios.get(
        `https://${this.apiAccountName}.app.invoicexpress.com/api/pdf/${documentId}.json?second_copy=false&api_key=${this.apiKey}`,
      );
      
      this.logger.debug(`Invoice API response status: ${response.status}`);
      
      if (response?.data?.output?.pdfUrl) {
        this.logger.log(`PDF URL found: ${response.data.output.pdfUrl}`);
        
        const { data: buffer, contentType } =
          await this.uploadService.getBufferFromUrl(
            response?.data?.output?.pdfUrl,
          );
          
        this.logger.log(`PDF buffer size: ${buffer.length} bytes, content type: ${contentType}`);
        
        const url = await this.uploadService.uploadFile(buffer, {
          ContentType: contentType,
          Key: `invoices/${documentId}.pdf`,
        });
        
        this.logger.log(`Invoice uploaded to: ${url}`);
        
        return {
          url,
          contentType,
          buffer,
        };
      } else {
        this.logger.warn(`No PDF URL found in response for documentId: ${documentId}`);
        this.logger.debug('Response data:', response?.data);
        
        if (retryCount < maxRetries) {
          this.logger.warn(
            `Retrying fetchInvoice (attempt ${retryCount + 1} of ${maxRetries})`,
          );
          await sleep(800);
          return await this.fetchInvoice(
            documentId,
            retryCount + 1,
            maxRetries,
          );
        }
      }
      
      this.logger.warn(`Failed to fetch invoice after ${maxRetries} attempts for documentId: ${documentId}`);
      return null;
    } catch (e) {
      this.logger.error(`Error fetching invoice for documentId ${documentId}:`, e);
      return null;
    }
  }
}
