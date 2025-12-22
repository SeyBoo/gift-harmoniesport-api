import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order } from '../../payment/entities/order.entity';
import { User } from '../../users/entities/user.entity';
import { UserTypeEnum } from '../../users/entities/user-type.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Product } from '../../products/entities/product.entity';
import { DashboardMetricsDto, TimeRange } from './dto/dashboard-metrics.dto';
import dayjs from 'dayjs';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async getDashboardMetrics(query: DashboardMetricsDto) {
    const { timeRange, startDate, endDate } = query;
    const dateRange = this.getDateRange(timeRange, startDate, endDate);

    const [
      totalAssociations,
      activeAssociations,
      totalCampaigns,
      activeCampaigns,
      totalOrders,
      totalRevenue,
      revenueByMonth,
      associationsByThematic,
      topAssociations,
      recentOrders
    ] = await Promise.all([
      this.getTotalAssociations(),
      this.getActiveAssociations(),
      this.getTotalCampaigns(dateRange),
      this.getActiveCampaigns(dateRange),
      this.getTotalOrders(dateRange),
      this.getTotalRevenue(dateRange),
      this.getRevenueByMonth(dateRange),
      this.getAssociationsByThematic(),
      this.getTopAssociations(dateRange),
      this.getRecentOrders(dateRange)
    ]);

    return {
      overview: {
        totalAssociations,
        activeAssociations,
        totalCampaigns,
        activeCampaigns,
        totalOrders,
        totalRevenue,
      },
      revenueTrend: revenueByMonth,
      associationsDistribution: associationsByThematic,
      topPerformers: topAssociations,
      recentActivity: recentOrders
    };
  }

  private getDateRange(timeRange: TimeRange, startDate?: string, endDate?: string) {
    if (startDate && endDate) {
      return {
        start: new Date(startDate),
        end: new Date(endDate)
      };
    }

    const now = new Date();
    let start: Date;

    switch (timeRange) {
      case TimeRange.DAY:
        start = new Date(now.setDate(now.getDate() - 1));
        break;
      case TimeRange.WEEK:
        start = new Date(now.setDate(now.getDate() - 7));
        break;
      case TimeRange.MONTH:
        start = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case TimeRange.QUARTER:
        start = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case TimeRange.YEAR:
        start = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case TimeRange.ALL:
        start = new Date(0);
        break;
      default:
        start = new Date(now.setMonth(now.getMonth() - 1));
    }

    return { start, end: new Date() };
  }

  private async getTotalAssociations() {
    return this.userRepository.count({
      where: { userType: { name: UserTypeEnum.ASSOCIATION } }
    });
  }

  private async getActiveAssociations() {
    return this.userRepository.count({
      where: { 
        userType: { name: UserTypeEnum.ASSOCIATION },
        isActive: true
      }
    });
  }

  private async getTotalCampaigns(dateRange: { start: Date; end: Date }) {
    return this.campaignRepository.count({
      where: {
        createdAt: Between(dateRange.start, dateRange.end)
      }
    });
  }

  private async getActiveCampaigns(dateRange: { start: Date; end: Date }) {
    return this.campaignRepository.count({
      where: {
        createdAt: Between(dateRange.start, dateRange.end),
      }
    });
  }

  private async getTotalOrders(dateRange: { start: Date; end: Date }) {
    return this.orderRepository.count({
      where: {
        createdAt: Between(dateRange.start, dateRange.end),
        status: 'SUCCEEDED'
      }
    });
  }

  private async getTotalRevenue(dateRange: { start: Date; end: Date }) {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.price)', 'total')
      .where('order.createdAt BETWEEN :start AND :end', dateRange)
      .andWhere('order.status = :status', { status: 'SUCCEEDED' })
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  private async getRevenueByMonth(dateRange: { start: Date; end: Date }) {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('DATE_FORMAT(order.createdAt, \'%Y-%m\')', 'month')
      .addSelect('SUM(order.price)', 'revenue')
      .where('order.createdAt BETWEEN :start AND :end', dateRange)
      .andWhere('order.status = :status', { status: 'SUCCEEDED' })
      .groupBy('DATE_FORMAT(order.createdAt, \'%Y-%m\')')
      .orderBy('month', 'ASC')
      .getRawMany();

    return result.map(item => ({
      month: dayjs(item.month + '-01').format('MMM YYYY'),
      revenue: parseFloat(item.revenue || '0')
    }));
  }

  private async getAssociationsByThematic() {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .select('thematic.name', 'thematic')
      .addSelect('COUNT(user.id)', 'count')
      .leftJoin('user.thematic', 'thematic')
      .where('user.userType = :type', { type: UserTypeEnum.ASSOCIATION })
      .groupBy('thematic.name')
      .getRawMany();

    return result.map(item => ({
      thematic: item.thematic || 'Uncategorized',
      count: parseInt(item.count)
    }));
  }

  private async getTopAssociations(dateRange: { start: Date; end: Date }) {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('user.name_association', 'name')
      .addSelect('SUM(order.price)', 'revenue')
      .addSelect('COUNT(order.id)', 'orders')
      .leftJoin('order.userProducts', 'userProduct')
      .leftJoin('userProduct.product', 'product')
      .leftJoin('product.campaign', 'campaign')
      .leftJoin('campaign.user', 'user')
      .where('order.createdAt BETWEEN :start AND :end', dateRange)
      .andWhere('order.status = :status', { status: 'SUCCEEDED' })
      .groupBy('user.id')
      .orderBy('revenue', 'DESC')
      .limit(5)
      .getRawMany();

    return result.map(item => ({
      name: item.name,
      revenue: parseFloat(item.revenue || '0'),
      orders: parseInt(item.orders)
    }));
  }

  private async getRecentOrders(dateRange: { start: Date; end: Date }) {
    return this.orderRepository.find({
      where: {
        createdAt: Between(dateRange.start, dateRange.end),
        status: 'SUCCEEDED'
      },
      relations: ['userProducts', 'userProducts.product', 'userProducts.product.campaign', 'userProducts.product.campaign.user'],
      order: { createdAt: 'DESC' },
      take: 5
    });
  }
} 