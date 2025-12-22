import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order } from '../../../payment/entities/order.entity';
import { Product } from '../../../products/entities/product.entity';
import { AdminOrder, AdminOrderProduct } from '../types/order.interface';

@Injectable()
export class AdminOrderUtils {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async formatOrder(order: Order): Promise<AdminOrder> {
    // Extract unique products from order items and userProducts
    let products: AdminOrderProduct[] = order.userProducts?.map(up => ({
      id: up.product.id,
      name: up.product.name,
    })) || [];

    // Fallback: If no userProducts, extract from order.items and query Product table
    if (products.length === 0 && order.items && order.items.length > 0) {
      const productIds = order.items
        .map(item => parseInt(item.productId))
        .filter(id => !isNaN(id));

      if (productIds.length > 0) {
        const productsFromDb = await this.productRepository.find({
          where: { id: In(productIds) },
          select: ['id', 'name'],
        });

        products = productsFromDb.map(p => ({
          id: p.id,
          name: p.name,
        }));
      }
    }

    return {
      paymentIntentId: order.paymentIntentId,
      customerName: `${order.firstname || ''} ${order.lastname || ''}`.trim() || 'N/A',
      delivery_address: order.delivery_address,
      delivery_address_information: order.delivery_address_information,
      delivery_city: order.delivery_city,
      delivery_country: order.delivery_country,
      delivery_postalcode: order.delivery_postalcode,
      delivery_status: order.delivery_status,
      createdAt: order.createdAt,
      items: order.items,
      updatedAt: order.updatedAt,
      products: products,
      total: order.price,
      id: order.id,
    };
  }

  async formatOrders(orders: Order[]): Promise<AdminOrder[]> {
    return Promise.all(orders.map((order) => this.formatOrder(order)));
  }
}
