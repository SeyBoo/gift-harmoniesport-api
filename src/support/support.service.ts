import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { MailjetService } from '../common/mailjet/mailjet.service';
import { ContactSupportDto } from './dto/contact-support.dto';
import { Order } from '../payment/entities/order.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class SupportService {
  private readonly SUPPORT_EMAIL = 'contact@giftasso.com';

  constructor(
    private readonly mailjetService: MailjetService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async sendSupportMessage(
    contactData: ContactSupportDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const emailContent = `
        <h3>New Support Message</h3>
        <p><strong>Name:</strong> ${contactData.name || 'Not provided'}</p>
        <p><strong>Email:</strong> ${contactData.email}</p>
        <p><strong>Subject:</strong> ${contactData.subject || 'No subject'}</p>
        <hr>
        <p><strong>Message:</strong></p>
        <p>${contactData.message}</p>
      `;

      const textContent = `
        New Support Message
        
        Name: ${contactData.name || 'Not provided'}
        Email: ${contactData.email}
        Subject: ${contactData.subject || 'No subject'}
        
        Message:
        ${contactData.message}
      `;

      await this.mailjetService.sendEmail(
        this.SUPPORT_EMAIL,
        contactData.subject || 'Support Request',
        textContent,
        emailContent,
      );

      return {
        success: true,
        message: 'Support message sent successfully',
      };
    } catch (error) {
      console.error('Error sending support message:', error);
      throw new Error('Failed to send support message');
    }
  }

  async getUnfulfilledOrders(): Promise<
    { name: string; type: string; count: number }[]
  > {
    const orders = await this.orderRepository.find({
      where: {
        status: 'succeeded', // Only successful payments
        exported: false, // Only unfulfilled orders
      },
      relations: ['user'],
      order: {
        createdAt: 'DESC',
      },
    });


    // Count products by name and type
    const productCounts = new Map<
      string,
      { name: string; type: string; count: number }
    >();

    // Get all unique product IDs from all orders
    const allProductIds = new Set<string>();
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        if (item.productType !== 'digital') {
          allProductIds.add(item.productId);
        }
      });
    });

    // Fetch all products at once
    const productIds = Array.from(allProductIds).map(id => parseInt(id, 10));
    const products = await this.productRepository.find({
      where: { id: In(productIds) },
    });
    const productMap = new Map(products.map(p => [p.id.toString(), p]));

    orders.forEach((order) => {
      order.items?.forEach((item) => {
        // Skip digital products
        if (item.productType === 'digital') {
          return;
        }

        // Get product from the fetched products
        const product = productMap.get(item.productId);
        
        if (product) {
          const key = `${product.id}-${item.productType}`;
          if (productCounts.has(key)) {
            productCounts.get(key)!.count += item.quantity;
          } else {
            productCounts.set(key, {
              name: product.name,
              type: item.productType,
              count: item.quantity,
            });
          }
        }
      });
    });

    return Array.from(productCounts.values());
  }

  async exportUnfulfilledOrdersCSV(): Promise<string> {
    const productData = await this.getUnfulfilledOrders();

    // Create CSV header
    const csvHeader = 'Product Name,Product Type,Count\n';

    // Create CSV rows
    const csvRows = productData
      .map((item) => `"${item.name}","${item.type}",${item.count}`)
      .join('\n');

    return csvHeader + csvRows;
  }

  async sendWeeklyOrdersRecap(): Promise<{
    success: boolean;
    message: string;
    recapData?: any;
  }> {
    try {
      // Get orders from past week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const orders = await this.orderRepository.find({
        where: {
          status: 'succeeded',
          createdAt: MoreThanOrEqual(oneWeekAgo),
        },
        relations: ['user', 'userProducts', 'userProducts.product'],
        order: {
          createdAt: 'DESC',
        },
      });

      const totalRevenue = orders.reduce((sum, order) => {
        return sum + parseFloat(order.price || '0');
      }, 0);

      // Count products by name and type (excluding digital)
      const productCounts = new Map<
        string,
        { name: string; type: string; count: number }
      >();

      orders.forEach((order) => {
        order.items?.forEach((item) => {
          if (item.productType === 'digital') {
            return;
          }

          const userProduct = order.userProducts?.find(
            (up) => up.productId.toString() === item.productId,
          );
          if (userProduct?.product) {
            const key = `${userProduct.product.id}-${item.productType}`;
            if (productCounts.has(key)) {
              productCounts.get(key)!.count += item.quantity;
            } else {
              productCounts.set(key, {
                name: userProduct.product.name,
                type: item.productType,
                count: item.quantity,
              });
            }
          }
        });
      });

      const productSummary = Array.from(productCounts.values());

      // Create email content
      const emailContent = `
        <h2>Récapitulatif Hebdomadaire des Commandes</h2>
        <p><strong>Période:</strong> ${oneWeekAgo.toLocaleDateString('fr-FR')} - ${new Date().toLocaleDateString('fr-FR')}</p>
        <p><strong>Nombre de commandes:</strong> ${orders.length}</p>
        <p><strong>Chiffre d'affaires:</strong> ${totalRevenue.toFixed(2)} €</p>
        
        <h3>Produits commandés (hors digital):</h3>
        <ul>
          ${productSummary.map((item) => `<li>${item.name} (${item.type}): ${item.count} unité(s)</li>`).join('')}
        </ul>
      `;

      const textContent = `
        Récapitulatif Hebdomadaire des Commandes
        
        Période: ${oneWeekAgo.toLocaleDateString('fr-FR')} - ${new Date().toLocaleDateString('fr-FR')}
        Nombre de commandes: ${orders.length}
        Chiffre d'affaires: ${totalRevenue.toFixed(2)} €
        
        Produits commandés (hors digital):
        ${productSummary.map((item) => `- ${item.name} (${item.type}): ${item.count} unité(s)`).join('\n')}
      `;

      // Only send email if there are sales
      if (orders.length === 0) {
        return {
          success: true,
          message: 'Aucune commande cette semaine - aucun email envoyé',
          recapData: {
            orders: 0,
            revenue: '0.00',
            recipients: [],
            products: [],
          },
        };
      }

      // Send email to multiple recipients
      const recipients = [
        'antoine@giftasso.com',
        'david@giftasso.com',
        'jc.queyroux@metacard.gift',
        'kader@giftasso.com',
      ];

      try {
        await this.mailjetService.sendEmail(
          recipients.join(', '),
          `Récapitulatif Hebdomadaire - ${orders.length} commandes`,
          textContent,
          emailContent,
        );

        return {
          success: true,
          message: `Récapitulatif hebdomadaire envoyé à ${recipients.length} destinataires. ${orders.length} commandes pour ${totalRevenue.toFixed(2)} €`,
          recapData: {
            orders: orders.length,
            revenue: totalRevenue.toFixed(2),
            recipients: recipients,
            products: productSummary,
          },
        };
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Return data without sending email
        return {
          success: true,
          message: `Récapitulatif hebdomadaire généré (email non envoyé - configuration SMTP manquante). ${orders.length} commandes pour ${totalRevenue.toFixed(2)} €`,
          recapData: {
            orders: orders.length,
            revenue: totalRevenue.toFixed(2),
            recipients: recipients,
            products: productSummary,
          },
        };
      }
    } catch (error) {
      console.error('Error sending weekly recap:', error);
      throw new Error('Failed to send weekly recap email');
    }
  }
}
