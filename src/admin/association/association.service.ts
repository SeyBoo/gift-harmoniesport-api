import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserTypeEnum } from '../../users/entities/user-type.entity';
import { AssociationStatus, ListAssociationsDto } from '../../common/dtos';
import { UserAffiliation } from '../../users/entities/user-affiliation.entity';
import { Product } from '../../products/entities/product.entity';
import { Order, PAYMENT_STATUS } from '../../payment/entities/order.entity';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(weekOfYear);

@Injectable()
export class AssociationsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(UserAffiliation)
    private readonly userAffiliationRepository: Repository<UserAffiliation>,
  ) { }

  async listAssociations(queryParams: ListAssociationsDto) {
    const { search, thematicId, status } = queryParams;
    const page = queryParams.page || 1;
    const limit = queryParams.limit || 10;

    const where: any = {
      userType: { name: UserTypeEnum.ASSOCIATION },
    };

    if (search) {
      where[search.includes('@') ? 'email' : 'name_association'] = Like(
        `%${search}%`,
      );
    }

    if (thematicId) {
      where.thematic = { id: thematicId };
    }

    if (status && status !== AssociationStatus.ALL) {
      where.isActive = status === AssociationStatus.ACTIVE;
    }

    const [associations, total] = await this.userRepository.findAndCount({
      where,
      relations: ['userType', 'thematic'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const items = associations.map((association) => ({
      id: association.id,
      name: association.name_association,
      email: association.email,
      thematic: association.thematic?.name,
      status: association.isActive ? 'Active' : 'Inactive',
      website: association.site_internet,
      createdAt: association.createdAt,
      logo: association.logo,
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async toggleStatus(id: number, isActive: boolean) {
    const association = await this.userRepository.findOne({
      where: {
        id,
        userType: { name: UserTypeEnum.ASSOCIATION },
      },
      relations: ['userType'],
    });

    if (!association) {
      throw new NotFoundException('Association not found');
    }

    association.isActive = isActive;
    await this.userRepository.save(association);

    return {
      id: association.id,
      status: isActive ? 'Active' : 'Inactive',
      message: `Association ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }
  async getAssociationDetails(id: number) {
    const association = await this.userRepository.findOne({
      where: {
        id,
        userType: { name: UserTypeEnum.ASSOCIATION },
      },
      relations: ['orders', 'sponsors', 'campaigns', 'campaigns.products', 'thematic'],
    });

    if (!association) {
      throw new NotFoundException('Association not found');
    }

    // Calculate fiscal metrics
    const orders = association.orders || [];
    const totalOrders = orders.length;
    const completedFiscalReceipts = orders.filter(order => order.fisc_status === 'COMPLETED').length;
    const fiscalReceiptsRatio = totalOrders > 0 ? (completedFiscalReceipts / totalOrders) * 100 : 0;
    
    const totalDonations = orders.reduce((sum, order) => {
      const price = parseFloat(order.price || '0');
      return sum + price;
    }, 0);

    const donationsToReceiptsRatio = completedFiscalReceipts > 0 ? (totalDonations / completedFiscalReceipts) : 0;

    // Calculate sponsorship metrics
    const sponsors = association.sponsors || [];
    const totalSponsors = sponsors.length;
    
    const sponsorsByCategory = sponsors.reduce((acc, sponsor) => {
      const category = association.thematic?.name || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    // Calculate video metrics
    const promotionalVideosCount = association.campaigns.reduce((count, campaign) => {
      return count + (campaign.products?.filter(product => product.video_promo).length || 0);
    }, 0);

    const thankYouVideosCount = association.campaigns.reduce((count, campaign) => {
      return count + (campaign.products?.filter(product => product.video_thanks).length || 0);
    }, 0);

    return {
      ...association,
      fiscalMetrics: {
        fiscalReceiptsRatio,
        donationsToReceiptsRatio,
        totalFiscalReceipts: completedFiscalReceipts,
        totalDonations,
      },
      sponsorshipMetrics: {
        totalSponsors,
        sponsorsByCategory,
        promotionalVideosCount,
        thankYouVideosCount,
        sponsorshipCategories: sponsorsByCategory,
      }
    };
  }

  async getDashboardMetrics(
    associationId: number,
    options: {
      startDate?: string;
      endDate?: string;
      period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semiAnnual' | 'annual' | 'allTime';
    },
  ) {
    const association = await this.userRepository.findOne({
      where: { id: associationId },
      relations: ['campaigns', 'userProducts'],
    });

    if (!association) {
      throw new NotFoundException('Association not found');
    }

    const { startDate, endDate, period = 'monthly' } = options;
    const dateRange = this.getDateRange(period, startDate, endDate);

    const [
      userMetrics,
      campaignMetrics,
      cardMetrics,
      financialMetrics,
      timePerformance,
    ] = await Promise.all([
      this.getUserMetrics(associationId, dateRange),
      this.getCampaignMetrics(associationId, dateRange),
      this.getCardMetrics(associationId, dateRange),
      this.getFinancialMetrics(associationId, dateRange),
      this.getTimePerformance(associationId, period, dateRange),
    ]);

    return {
      userMetrics,
      campaignMetrics,
      cardMetrics,
      financialMetrics,
      timePerformance,
    };
  }

  private getDateRange(
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    if (startDate && endDate) {
      return {
        start: dayjs(startDate).startOf('day').toDate(),
        end: dayjs(endDate).endOf('day').toDate(),
      };
    }

    const now = dayjs();
    let start: Date;

    switch (period) {
      case 'daily':
        start = now.subtract(7, 'day').toDate();
        break;
      case 'weekly':
        start = now.subtract(28, 'day').toDate();
        break;
      case 'monthly':
        start = now.subtract(1, 'month').toDate();
        break;
      case 'quarterly':
        start = now.subtract(3, 'month').toDate();
        break;
      case 'semiAnnual':
        start = now.subtract(6, 'month').toDate();
        break;
      case 'annual':
        start = now.subtract(12, 'month').toDate();
        break;
      case 'allTime':
        start = new Date(0); // Beginning of time
        break;
      default:
        start = now.subtract(1, 'month').toDate();
    }

    return {
      start: dayjs(start).startOf('day').toDate(),
      end: dayjs(now).endOf('day').toDate(),
    };
  }

  private async getUserMetrics(associationId: number, dateRange: { start: Date; end: Date }) {
    const successfulOrders = await this.orderRepository.find({
      where: {
        userProducts: {
          product: {
            campaign: {
              user: { id: associationId },
            },
          },
        },
        status: PAYMENT_STATUS.SUCCEEDED,
        createdAt: Between(dateRange.start, dateRange.end),
      },
      relations: ['user', 'userProducts', 'userProducts.product', 'userProducts.product.campaign', 'userProducts.product.campaign.user'],
    });

    const uniqueDonors = new Set(successfulOrders.map(order => order.userId));
    const totalDonations = successfulOrders.reduce((sum, order) =>
      sum + (parseFloat(order.price) || 0), 0
    );

    return {
      totalDonors: uniqueDonors.size,
      averageDonation: uniqueDonors.size ? totalDonations / uniqueDonors.size : 0,
      totalDonations,
    };
  }

  private async getCampaignMetrics(associationId: number, dateRange: { start: Date; end: Date }) {
    const campaigns = await this.userRepository.findOne({
      where: { id: associationId },
      relations: ['campaigns'],
    }).then(user => user?.campaigns || []);

    // const activeCampaigns = campaigns.filter(campaign =>
    //   new Date(campaign.createdAt) >= dateRange.start &&
    //   new Date(campaign.createdAt) <= dateRange.end
    // );

    const activeCampaigns = campaigns;
    
    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: activeCampaigns.length,
    };
  }

  private async getCardMetrics(associationId: number, dateRange: { start: Date; end: Date }) {
    const products = await this.productRepository.find({
      where: {
        campaign: {
          user: { id: associationId },
        },
        createdAt: Between(dateRange.start, dateRange.end),
      },
      relations: ['userProducts'],
    });

    return {
      totalCards: products.length,
      totalDownloads: products.reduce((sum, product) =>
        sum + (product.userProducts?.length || 0), 0
      ),
    };
  }

  private async getFinancialMetrics(associationId: number, dateRange: { start: Date; end: Date }) {
    const orders = await this.orderRepository.find({
      where: {
        userProducts: {
          product: {
            campaign: {
              user: { id: associationId },
            },
          },
        },
        status: PAYMENT_STATUS.SUCCEEDED,
        createdAt: Between(dateRange.start, dateRange.end),
      },
      relations: ['userProducts', 'userProducts.product', 'userProducts.product.campaign', 'userProducts.product.campaign.user'],
    });

    const totalSales = orders.reduce((sum, order) =>
      sum + (parseFloat(order.price) || 0), 0
    );

    return {
      totalSales,
      totalOrders: orders.length,
      averageOrderValue: orders.length ? totalSales / orders.length : 0,
    };
  }

  private async getTimePerformance(
    associationId: number,
    period: string,
    dateRange: { start: Date; end: Date },
  ) {
    const orders = await this.orderRepository.find({
      where: {
        userProducts: {
          product: {
            campaign: {
              user: { id: associationId },
            },
          },
        },
        status: PAYMENT_STATUS.SUCCEEDED,
        createdAt: Between(dateRange.start, dateRange.end),
      },
      relations: ['userProducts', 'userProducts.product', 'userProducts.product.campaign', 'userProducts.product.campaign.user'],
    });

    const performanceData = new Map<string, number>();

    orders.forEach(order => {
      const date = dayjs(order.createdAt);
      let key: string;

      switch (period) {
        case 'daily':
          key = date.format('YYYY-MM-DD');
          break;
        case 'weekly':
          key = `Week ${date.week()}`;
          break;
        case 'monthly':
          key = date.format('MMM YYYY');
          break;
        case 'quarterly':
          key = `Q${Math.floor(date.month() / 3) + 1} ${date.year()}`;
          break;
        case 'semiAnnual':
          key = `H${Math.floor(date.month() / 6) + 1} ${date.year()}`;
          break;
        case 'annual':
          key = date.year().toString();
          break;
        default:
          key = date.format('MMM YYYY');
      }

      performanceData.set(
        key,
        (performanceData.get(key) || 0) + (parseFloat(order.price) || 0)
      );
    });

    return Array.from(performanceData.entries()).map(([date, value]) => ({
      date,
      value,
    }));
  }
}
