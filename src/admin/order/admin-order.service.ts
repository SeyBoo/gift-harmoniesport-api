import { PaginationDto } from '../../common/dtos';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DELIVERY_STATUS, Order } from '../../payment/entities/order.entity';
import { Repository, Like, In, Raw, Between, MoreThan } from 'typeorm';
import { AdminOrderUtils } from './utils/admin-order.utils';
import { MailjetService } from '../../common/mailjet/mailjet.service';

@Injectable()
export class AdminOrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly adminOrderUtils: AdminOrderUtils,
    private readonly mailjetService: MailjetService,
  ) {}

  async findAllOrders(
    pagination: PaginationDto, 
    associationId: number,
    startDate?: Date,
    endDate?: Date
  ) {
    const { page, limit, search } = pagination;

    const whereClause = {
      status: 'succeeded',
      delivery_status: In([DELIVERY_STATUS.PENDING, DELIVERY_STATUS.SHIPPED]),
      // Only show orders containing at least one physical item (collector or magnet)
      // This filters out all digital-only orders
      items: Raw(
        (items) =>
          `(JSON_SEARCH(${items}, 'one', 'collector', NULL, '$[*].productType') IS NOT NULL OR JSON_SEARCH(${items}, 'one', 'magnet', NULL, '$[*].productType') IS NOT NULL)`,
      ),
      ...(search && {
        paymentIntentId: Like(`%${search}%`),
      }),
      ...(startDate && endDate && {
        createdAt: Between(startDate, endDate),
      }),
      ...(startDate && !endDate && {
        createdAt: MoreThan(startDate),
      }),
    };

    let query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.userProducts', 'userProduct')
      .leftJoinAndSelect('userProduct.product', 'product')
      .leftJoinAndSelect('product.campaign', 'campaign')
      .leftJoinAndSelect('campaign.user', 'campaignUser')
      .where(whereClause)
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // If associationId is provided, filter by checking product ownership through items
    if (associationId) {
      query = query.andWhere(
        `EXISTS (
          SELECT 1 FROM product p 
          INNER JOIN campaign c ON c.id = p.campaign_id 
          WHERE c.user_id = :associationId 
          AND p.handle_distribution = 0
          AND p.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(order.items, '$[0].productId')) AS UNSIGNED)
        )`,
        { associationId }
      );
    }

    const [orders, total] = await query.getManyAndCount();

    const formattedOrders = await this.adminOrderUtils.formatOrders(orders);

    return {
      items: formattedOrders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateOrderStatus(
    id: number,
    status: DELIVERY_STATUS,
  ) {
    const data = await this.orderRepository.update(id, {
      delivery_status: status,
    });

    // Only send email notification when order is marked as shipped (in delivery)
    if (status === DELIVERY_STATUS.SHIPPED) {
      const order = await this.orderRepository.findOne({
        where: { id },
        relations: ['user'],
      });

      if (order && order.user) {
        const customerName = `${order.firstname || ''} ${order.lastname || ''}`.trim() || order.user.name || '';

        await this.mailjetService.sendTransactionalEmail(
          order.user.email,
          6763512,
          {
            delivery_status: order.delivery_status,
            order_id: order.id,
            customer_name: customerName,
          },
        );
      }
    }

    return {
      message: 'Order status updated successfully',
      status: 'success',
      data,
    };
  }
}
