import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Order } from '../payment/entities/order.entity';
import { Repository, MoreThan, Between } from 'typeorm';
import { FilterSales, SortOrder } from './dashboard.interface';
import { DataSource } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    private readonly dataSource: DataSource,
  ) {}

  async getSales(associationId: number, filter: FilterSales) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let salesData;

    switch (filter) {
      case FilterSales.ALL_TIME:
        salesData = await this.getSalesForPeriod(associationId);
        break;
      case FilterSales.LAST_30_DAYS:
        salesData = await this.getSalesForPeriod(associationId, thirtyDaysAgo);
        break;
      case FilterSales.LAST_7_DAYS:
        salesData = await this.getSalesForPeriod(associationId, sevenDaysAgo);
        break;
      default:
        salesData = await this.getSalesForPeriod(associationId);
        break;
    }

    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const monthlyChange = await this.calculateMonthlyChange(
      associationId,
      currentMonth.toString(),
      currentYear.toString(),
    );

    return {
      sales: salesData,
      monthlyChange: parseFloat(monthlyChange.toFixed(2)),
    };
  }

  async getCampaignsBySales(
    associationId: number,
    filter: FilterSales,
    sortOrder: SortOrder = SortOrder.MOST_SOLD,
  ) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let startDate: Date | undefined;

    switch (filter) {
      case FilterSales.LAST_30_DAYS:
        startDate = thirtyDaysAgo;
        break;
      case FilterSales.LAST_7_DAYS:
        startDate = sevenDaysAgo;
        break;
      case FilterSales.ALL_TIME:
      default:
        startDate = undefined;
        break;
    }

    let timeFilter = '';
    if (startDate) {
      timeFilter = `AND o.created_at >= '${startDate.toISOString()}'`;
    }

    const direction = sortOrder === SortOrder.MOST_SOLD ? 'DESC' : 'ASC';

    const query = `
      SELECT 
        c.id,
        c.campagne_name as name,
        c.date_start as startDate,
        c.date_end as endDate,
        COUNT(DISTINCT o.id) as salesCount
      FROM campaign c
      LEFT JOIN product p ON p.campaign_id = c.id
      LEFT JOIN \`order\` o ON (
        o.items IS NOT NULL 
        AND p.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(o.items, '$[0].productId')) AS UNSIGNED)
        AND o.status = 'succeeded'
        ${timeFilter}
      )
      WHERE c.user_id = ${associationId}
      GROUP BY c.id, c.campagne_name, c.date_start, c.date_end
      ORDER BY salesCount ${direction}
    `;

    const campaigns = await this.campaignRepository.query(query);

    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      salesCount: Number(campaign.salesCount),
    }));
  }

  async getBundlesBySales(
    associationId: number,
    filter: FilterSales,
    sortOrder: SortOrder = SortOrder.MOST_SOLD,
  ) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let startDate: Date | undefined;

    switch (filter) {
      case FilterSales.LAST_30_DAYS:
        startDate = thirtyDaysAgo;
        break;
      case FilterSales.LAST_7_DAYS:
        startDate = sevenDaysAgo;
        break;
      case FilterSales.ALL_TIME:
      default:
        startDate = undefined;
        break;
    }

    let timeFilter = '';
    if (startDate) {
      timeFilter = `AND o.created_at >= '${startDate.toISOString()}'`;
    }

    const direction = sortOrder === SortOrder.MOST_SOLD ? 'DESC' : 'ASC';

    const query = `
      SELECT 
        CASE 
          WHEN item_data.productType = 'digital' THEN 'bundle-digital'
          WHEN item_data.productType = 'collector' THEN 'bundle-premium'
          WHEN item_data.productType = 'magnet' THEN 'bundle-basic'
          ELSE 'bundle-basic'
        END AS bundleId,
        SUM(item_data.quantity) AS salesCount
      FROM \`order\` o
      INNER JOIN product product ON product.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(o.items, '$[0].productId')) AS UNSIGNED)
      INNER JOIN campaign campaign ON campaign.id = product.campaign_id
      JOIN JSON_TABLE(
        o.items,
        '$[*]' COLUMNS (
          productType VARCHAR(255) PATH '$.productType',
          quantity INT PATH '$.quantity'
        )
      ) AS item_data
      WHERE campaign.user_id = ${associationId}
      AND o.items IS NOT NULL 
      AND o.status = 'succeeded'
      ${timeFilter}
      GROUP BY bundleId
      ORDER BY salesCount ${direction}
    `;

    const bundleResults = await this.orderRepository.query(query);

    return bundleResults.map((result) => ({
      bundleId: result.bundleId,
      salesCount: Number(result.salesCount),
    }));
  }

  private async getSalesForPeriod(associationId: number, startDate?: Date) {
    const query = this.buildProductSalesQuery(associationId, startDate);

    return await query
      .groupBy('userProduct.product_id')
      .addGroupBy('product.name')
      .addGroupBy('campaign.campagne_name')
      .orderBy('unitsSold', 'DESC')
      .limit(6)
      .getRawMany();
  }

  async getOverview(associationId: number) {
    const totalCampaigns = await this.getTotalCampaigns(associationId);
    const totalActiveCampaigns =
      await this.getTotalActiveCampaigns(associationId);
    const campaignGrowthRate = await this.getCampaignGrowthRate(
      associationId,
      true,
    );
    const activeCampaignGrowthRate = await this.getCampaignGrowthRate(
      associationId,
      false,
    );
    const [
      totalCardsSold,
      totalCardsSoldGrowthRate,
      turnoverLast30Days,
      turnoverGrowthRate,
      totalTurnover,
      totalTurnoverGrowthRate,
    ] = await Promise.all([
      this.getTotalCardsSold(associationId),
      this.getTotalCardsSoldGrowthRate(associationId),
      this.getTurnoverLast30Days(associationId),
      this.getTurnoverGrowthRate(associationId),
      this.getTotalTurnover(associationId),
      this.getTotalTurnoverGrowthRate(associationId),
    ]).then((results) => results.map((result) => result));
    return {
      // campaigns,
      totalActiveCampaigns,
      activeCampaignGrowthRate,
      totalCampaigns,
      campaignGrowthRate,
      totalCardsSold,
      totalCardsSoldGrowthRate,
      turnoverLast30Days,
      turnoverGrowthRate,
      totalTurnover,
      totalTurnoverGrowthRate,
    };
  }

  private async getTotalTurnoverGrowthRate(associationId: number) {
    const currentYearStart = new Date();
    currentYearStart.setMonth(0, 1);
    currentYearStart.setHours(0, 0, 0, 0);
    
    const previousYearStart = new Date(currentYearStart);
    previousYearStart.setFullYear(previousYearStart.getFullYear() - 1);
    
    const previousYearEnd = new Date(currentYearStart);
    previousYearEnd.setDate(previousYearEnd.getDate() - 1);
    previousYearEnd.setHours(23, 59, 59, 999);
    
    const currentYearResult = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(transaction.netAmount), 0)', 'total')
      .from('transaction', 'transaction')
      .where('transaction.association_id = :associationId', { associationId })
      .andWhere('transaction.created_at >= :currentYearStart', { currentYearStart })
      .andWhere('transaction.is_payout = :isPayout', { isPayout: false })
      .getRawOne();
    
    const previousYearResult = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(transaction.netAmount), 0)', 'total')
      .from('transaction', 'transaction')
      .where('transaction.association_id = :associationId', { associationId })
      .andWhere('transaction.created_at >= :previousYearStart', { previousYearStart })
      .andWhere('transaction.created_at <= :previousYearEnd', { previousYearEnd })
      .andWhere('transaction.is_payout = :isPayout', { isPayout: false })
      .getRawOne();
    
    const currentYearTurnover = parseFloat(currentYearResult.total) || 0;
    const previousYearTurnover = parseFloat(previousYearResult.total) || 0;
    
    if (previousYearTurnover === 0) {
      return currentYearTurnover > 0 ? 100 : 0;
    }
    
    return ((currentYearTurnover - previousYearTurnover) / previousYearTurnover) * 100;
  }

  private async getTotalTurnover(associationId: number) {
    const result = await this.dataSource
      .createQueryBuilder()
      .select('SUM(transaction.netAmount)', 'total')
      .from('transaction', 'transaction')
      .where('transaction.association_id = :associationId', { associationId })
      .andWhere('transaction.is_payout = :isPayout', { isPayout: false })
      .getRawOne();
    
    return result.total || 0;
  }

  async getTurnoverLast30Days(associationId: number): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await this.dataSource
      .createQueryBuilder()
      .select('SUM(transaction.netAmount)', 'total')
      .from('transaction', 'transaction')
      .where('transaction.association_id = :associationId', { associationId })
      .andWhere('transaction.created_at >= :thirtyDaysAgo', { thirtyDaysAgo })
      .andWhere('transaction.is_payout = :isPayout', { isPayout: false })
      .getRawOne();
    
    return result.total || 0;
  }

  async getTurnoverGrowthRate(associationId: number): Promise<number> {
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    
    const previousMonthStart = new Date(currentMonthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    
    const previousMonthEnd = new Date(currentMonthStart);
    previousMonthEnd.setDate(previousMonthEnd.getDate() - 1);
    previousMonthEnd.setHours(23, 59, 59, 999);
    
    const currentMonthResult = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(transaction.netAmount), 0)', 'total')
      .from('transaction', 'transaction')
      .where('transaction.association_id = :associationId', { associationId })
      .andWhere('transaction.created_at >= :currentMonthStart', { currentMonthStart })
      .andWhere('transaction.is_payout = :isPayout', { isPayout: false })
      .getRawOne();
    
    const previousMonthResult = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(transaction.netAmount), 0)', 'total')
      .from('transaction', 'transaction')
      .where('transaction.association_id = :associationId', { associationId })
      .andWhere('transaction.created_at >= :previousMonthStart', { previousMonthStart })
      .andWhere('transaction.created_at <= :previousMonthEnd', { previousMonthEnd })
      .andWhere('transaction.is_payout = :isPayout', { isPayout: false })
      .getRawOne();
    
    const currentMonthTurnover = parseFloat(currentMonthResult.total) || 0;
    const previousMonthTurnover = parseFloat(previousMonthResult.total) || 0;
    
    if (previousMonthTurnover === 0) {
      return currentMonthTurnover > 0 ? 100 : 0;
    }
    
    return ((currentMonthTurnover - previousMonthTurnover) / previousMonthTurnover) * 100;
  }

  private async getTotalCardsSold(associationId: number) {
    return this.orderRepository.count({
      where: {
        userProducts: {
          product: {
            campaign: { user: { id: associationId } },
          },
        },
        status: 'succeeded',
      },
      relations: ['userProducts', 'userProducts.product', 'userProducts.product.campaign', 'userProducts.product.campaign.user'],
    });
  }

  private async getTotalCardsSoldGrowthRate(
    associationId: number,
  ): Promise<number> {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const currentMonthQuery = {
      userProducts: {
        product: { campaign: { user: { id: associationId } } },
      },
      createdAt: Between(
        new Date(currentYear, currentMonth - 1, 1),
        new Date(currentYear, currentMonth, 0),
      ),
      status: 'succeeded',
    };

    const previousMonthQuery = {
      userProducts: {
        product: { campaign: { user: { id: associationId } } },
      },
      createdAt: Between(
        new Date(currentYear, currentMonth - 2, 1),
        new Date(currentYear, currentMonth - 1, 0),
      ),
      status: 'succeeded',
    };

    const currentMonthOrders = await this.orderRepository.count({
      where: currentMonthQuery,
      relations: ['userProducts', 'userProducts.product', 'userProducts.product.campaign', 'userProducts.product.campaign.user'],
    });

    const previousMonthOrders = await this.orderRepository.count({
      where: previousMonthQuery,
      relations: ['userProducts', 'userProducts.product', 'userProducts.product.campaign', 'userProducts.product.campaign.user'],
    });

    if (previousMonthOrders > 0) {
      return parseFloat(
        (
          ((currentMonthOrders - previousMonthOrders) / previousMonthOrders) *
          100
        ).toFixed(0),
      );
    } else if (currentMonthOrders > 0) {
      return 100;
    }

    return 0;
  }

  private async getTotalCampaigns(associationId: number) {
    return this.campaignRepository.count({
      where: {
        user: { id: associationId },
      },
    });
  }

  private async getTotalActiveCampaigns(associationId: number) {
    return this.campaignRepository.count({
      where: {
        user: { id: associationId },
        date_end: MoreThan(new Date()),
      },
    });
  }

  private async getCampaignGrowthRate(
    associationId: number,
    activeOnly: boolean = false,
  ) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const currentMonthQuery = {
      user: { id: associationId },
      date_start: Between(
        new Date(currentYear, currentMonth - 1, 1),
        new Date(currentYear, currentMonth, 0),
      ),
    };

    if (activeOnly) {
      currentMonthQuery['date_end'] = MoreThan(new Date());
    }

    const currentMonthCampaigns = await this.campaignRepository.count({
      where: currentMonthQuery,
    });

    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const previousMonthQuery = {
      user: { id: associationId },
      date_start: Between(
        new Date(prevYear, prevMonth - 1, 1),
        new Date(prevYear, prevMonth, 0),
      ),
    };

    if (activeOnly) {
      previousMonthQuery['date_end'] = MoreThan(new Date());
    }

    const previousMonthCampaigns = await this.campaignRepository.count({
      where: previousMonthQuery,
    });

    if (previousMonthCampaigns > 0) {
      return Number(
        (
          ((currentMonthCampaigns - previousMonthCampaigns) /
            previousMonthCampaigns) *
          100
        ).toFixed(0),
      );
    } else if (currentMonthCampaigns > 0) {
      return 100;
    }

    return 0;
  }

  private buildProductSalesQuery(associationId: number, startDate?: Date) {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .select('userProduct.product_id', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('campaign.campagne_name', 'campaignName')
      .addSelect('COUNT(order.id)', 'unitsSold')
      .innerJoin('order.userProducts', 'userProduct')
      .innerJoin('userProduct.product', 'product')
      .innerJoin('product.campaign', 'campaign')
      .innerJoin('campaign.user', 'user')
      .where('user.id = :associationId', { associationId })
      .andWhere('order.status = :status', { status: 'succeeded' });

    if (startDate) {
      query.andWhere('order.created_at >= :startDate', { startDate });
    }

    return query;
  }

  private async calculateMonthlyChange(
    associationId: number,
    month: string,
    year: string,
  ) {
    const currentSales = await this.getSalesCount(associationId, month, year);

    const { prevMonth, prevYear } = this.getPreviousMonthAndYear(month, year);

    const previousSales = await this.getSalesCount(
      associationId,
      prevMonth,
      prevYear,
    );

    if (previousSales > 0) {
      return ((currentSales - previousSales) / previousSales) * 100;
    } else if (currentSales > 0) {
      return 100;
    }

    return 0;
  }

  private async getSalesCount(
    associationId: number,
    month: string,
    year: string,
  ): Promise<number> {
    const salesData = await this.orderRepository
      .createQueryBuilder('order')
      .select('COUNT(order.id)', 'totalSales')
      .innerJoin('order.userProducts', 'userProduct')
      .innerJoin('userProduct.product', 'product')
      .innerJoin('product.campaign', 'campaign')
      .innerJoin('campaign.user', 'user')
      .where('user.id = :associationId', { associationId })
      .andWhere('MONTH(order.created_at) = :month', { month })
      .andWhere('YEAR(order.created_at) = :year', { year })
      .andWhere('order.status = :status', { status: 'succeeded' })
      .getRawOne();

    return parseInt(salesData?.totalSales || '0');
  }

  private getPreviousMonthAndYear(month: string, year: string) {
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    const prevMonth = monthNum === 1 ? '12' : (monthNum - 1).toString();
    const prevYear = monthNum === 1 ? (yearNum - 1).toString() : year;

    return { prevMonth, prevYear };
  }
}
