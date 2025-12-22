import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, analyticsdata_v1beta } from 'googleapis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private analyticsClient: analyticsdata_v1beta.Analyticsdata;
  private propertyId: string;
  // Maximum number of concurrent requests to avoid rate limiting
  private readonly MAX_CONCURRENT_REQUESTS = 20;
  // Smaller date ranges produce faster responses from Google Analytics
  private readonly DEFAULT_DATA_LOOKBACK_DAYS = 90; // ~3 months instead of 6

  constructor(
    private configService: ConfigService,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    this.propertyId = this.configService.get<string>(
      'GOOGLE_ANALYTICS_PROPERTY_ID',
    );

    // Log if property ID is missing
    if (!this.propertyId) {
      this.logger.warn(
        'Missing Google Analytics Property ID - analytics will be disabled',
      );
      return;
    }

    const clientEmail = this.configService.get<string>(
      'GOOGLE_ANALYTICS_CLIENT_EMAIL',
    );
    const privateKey = this.configService.get<string>(
      'GOOGLE_ANALYTICS_PRIVATE_KEY',
    );

    // Check if credentials are present
    if (!clientEmail || !privateKey) {
      this.logger.warn(
        'Missing Google Analytics credentials - analytics will be disabled',
      );
      return;
    }

    try {
      // Initialize with credentials
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });

      this.analyticsClient = google.analyticsdata({
        version: 'v1beta',
        auth,
      });
      this.logger.log(
        `Google Analytics initialized with property ID: ${this.propertyId}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize Google Analytics client', error);
    }
  }

  /**
   * Get page views for multiple URL paths in a single request to reduce API calls
   * @param urlPaths - Array of URL paths to get stats for
   * @param startDate - Start date in 'YYYY-MM-DD' format
   * @param endDate - End date in 'YYYY-MM-DD' format
   */
  async getBatchPageViews(
    urlPaths: string[],
    startDate: string,
    endDate: string,
  ) {
    try {
      // Skip analytics calls if not configured properly
      if (!this.analyticsClient || !this.propertyId) {
        this.logger.warn('Google Analytics client not properly configured');
        return new Map<string, any[]>();
      }

      if (urlPaths.length === 0) {
        return new Map<string, any[]>();
      }

      // Create a filter for multiple paths
      const dimensionFilter = {
        orGroup: {
          expressions: urlPaths.map(path => ({
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                matchType: 'EXACT',
                value: path,
              },
            },
          })),
        },
      };

      const response = await this.analyticsClient.properties.runReport({
        property: `properties/${this.propertyId}`,
        requestBody: {
          dateRanges: [
            {
              startDate,
              endDate,
            },
          ],
          dimensions: [
            {
              name: 'date',
            },
            {
              name: 'pagePath',
            },
          ],
          metrics: [
            {
              name: 'screenPageViews',
            },
          ],
          dimensionFilter,
        },
      });

      if (
        !response.data ||
        !response.data.rows ||
        response.data.rows.length === 0
      ) {
        return new Map<string, any[]>();
      }

      // Group results by pagePath
      const resultsByPath = new Map<string, any[]>();
      
      for (const row of response.data.rows) {
        const date = this.formatGADate(row.dimensionValues[0].value);
        const path = row.dimensionValues[1].value;
        const pageViews = parseInt(row.metricValues[0].value);
        
        if (!resultsByPath.has(path)) {
          resultsByPath.set(path, []);
        }
        
        resultsByPath.get(path).push({
          date,
          pagePath: path,
          pageViews,
        });
      }
      
      return resultsByPath;
    } catch (error) {
      this.logger.error(`Error fetching batch page views`, error);
      return new Map<string, any[]>();
    }
  }

  /**
   * Get page views for a specific URL path
   * @param urlPath - The URL path to get stats for (e.g., '/product/product-slug')
   * @param startDate - Start date in 'YYYY-MM-DD' format
   * @param endDate - End date in 'YYYY-MM-DD' format
   */
  async getPageViewsForUrl(
    urlPath: string,
    startDate: string,
    endDate: string,
  ) {
    try {
      // Skip analytics calls if not configured properly
      if (!this.analyticsClient || !this.propertyId) {
        this.logger.warn('Google Analytics client not properly configured');
        return [];
      }

      const response = await this.analyticsClient.properties.runReport({
        property: `properties/${this.propertyId}`,
        requestBody: {
          dateRanges: [
            {
              startDate,
              endDate,
            },
          ],
          dimensions: [
            {
              name: 'date',
            },
            {
              name: 'pagePath',
            },
          ],
          metrics: [
            {
              name: 'screenPageViews',
            },
          ],
          dimensionFilter: {
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                matchType: 'EXACT',
                value: urlPath,
              },
            },
          },
        },
      });

      if (
        !response.data ||
        !response.data.rows ||
        response.data.rows.length === 0
      ) {
        return [];
      }

      return response.data.rows.map((row) => ({
        date: this.formatGADate(row.dimensionValues[0].value),
        pagePath: row.dimensionValues[1].value,
        pageViews: parseInt(row.metricValues[0].value),
      }));
    } catch (error) {
      this.logger.error(`Error fetching page views for ${urlPath}`, error);
      // Return empty data instead of throwing error
      return [];
    }
  }

  /**
   * Get page views for product pages
   * @param productSlug - The product slug
   * @param days - Number of days to go back
   */
  async getProductPageViews(productSlug: string, days = this.DEFAULT_DATA_LOOKBACK_DAYS) {
    const { startDate, endDate } = this.getDateRangeForDays(days);
    return this.getPageViewsForUrl(`/card/${productSlug}`, startDate, endDate);
  }

  /**
   * Get page views for association pages
   * @param associationSlug - The association slug
   * @param days - Number of days to go back
   */
  async getAssociationPageViews(associationSlug: string, days = this.DEFAULT_DATA_LOOKBACK_DAYS) {
    const { startDate, endDate } = this.getDateRangeForDays(days);
    return this.getPageViewsForUrl(
      `/asso/${associationSlug}`,
      startDate,
      endDate,
    );
  }

  /**
   * Get all analytics for an association by ID
   * @param associationId - The association (user) ID
   * @param days - Number of days to go back
   */
  async getAssociationAnalytics(associationId: number, days = this.DEFAULT_DATA_LOOKBACK_DAYS) {
    const startTime = Date.now();
    
    // Find the association
    const association = await this.userRepository.findOne({
      where: { id: associationId },
    });

    if (!association || !association.slug) {
      throw new Error(
        `Association with ID ${associationId} not found or has no slug`,
      );
    }

    // Find all products for this association
    const products = await this.productRepository.find({
      where: { campaign: { user: { id: associationId } } },
      select: ['id', 'name', 'slug'],
    });

    const { startDate, endDate } = this.getDateRangeForDays(days);

    // Only track dates that actually have data instead of pre-initializing all dates
    const productViewsByDate = new Map<string, Array<{name: string, count: number}>>();
    
    // Use batch processing for better performance
    // Process in batches of MAX_CONCURRENT_REQUESTS to avoid GA API rate limits
    const allProductPaths = products.map(p => `/card/${p.slug}`);
    const batches = this.chunkArray(allProductPaths, this.MAX_CONCURRENT_REQUESTS);
    
    for (const batch of batches) {
      // Process each batch with a single API call
      const batchResults = await this.getBatchPageViews(batch, startDate, endDate);
      
      // Process the results for each product
      for (const [pagePath, views] of batchResults.entries()) {
        // Find product by path
        const productSlug = pagePath.replace('/card/', '');
        const product = products.find(p => p.slug === productSlug);
        
        if (!product) continue;
        
        // Update the data structure with views
        for (const view of views) {
          const date = view.date;
          
          // Only create entries for dates that have data
          if (view.pageViews > 0) {
            const existingProducts = productViewsByDate.get(date) || [];
            
            const existingProduct = existingProducts.find(p => p.name === product.name);
            
            if (existingProduct) {
              existingProduct.count += view.pageViews;
            } else {
              existingProducts.push({
                name: product.name,
                count: view.pageViews
              });
            }
            
            productViewsByDate.set(date, existingProducts);
          }
        }
      }
      
      // Small delay between batches if there are more batches to process
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Convert the map to an array of objects
    const result = Array.from(productViewsByDate.entries())
      .map(([date, products]) => ({
        date,
        products
      }))
      // Additional filter to ensure we only return dates with actual data
      .filter(item => item.products.length > 0);

    // Sort by date
    result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const endTime = Date.now();
    this.logger.log(`Association analytics for ID ${associationId} fetched in ${endTime - startTime}ms`);

    return result;
  }

  /**
   * Helper method to get date range for the last X days
   * @param days - Number of days to go back
   */
  private getDateRangeForDays(days: number) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    };
  }

  /**
   * Helper method to get date range for the last X months
   * @param months - Number of months to go back
   */
  private getDateRangeForMonths(months: number) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    };
  }

  /**
   * Format date to YYYY-MM-DD
   * @param date - Date to format
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Format date from Google Analytics format (YYYYMMDD) to YYYY-MM-DD
   * @param gaDate - Date in Google Analytics format (YYYYMMDD)
   */
  private formatGADate(gaDate: string): string {
    if (!gaDate || gaDate.length !== 8) return gaDate;
    const year = gaDate.substring(0, 4);
    const month = gaDate.substring(4, 6);
    const day = gaDate.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  /**
   * Helper method to split an array into chunks
   * @param array - Array to split
   * @param size - Size of each chunk
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
