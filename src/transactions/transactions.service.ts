import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Transaction } from './entity/transactions.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { PaginatedResponse } from '../common/interfaces/pagination.interface';
import { TransactionFilterDto } from './dto/transaction-filter.dto';
import { MailjetService } from '../common/mailjet/mailjet.service';
import { TransactionHistoryItemDto, OrderDetailsDto } from './dto/transaction-history.dto';
import { Order } from '../payment/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private mailService: MailjetService,
  ) {}

  async findAll(
    options: FindOptionsWhere<Transaction>,
  ): Promise<TransactionHistoryItemDto[]> {
    const transactions = await this.transactionRepository.find({
      where: options,
      relations: ['association', 'order'],
    });
    return this.mapTransactionsToHistoryDto(transactions);
  }

  async mapTransactionsToHistoryDto(transactions: Transaction[]): Promise<TransactionHistoryItemDto[]> {
    // Fetch order details for all transactions with an order
    const orderIds = transactions
      .filter((t) => t.order)
      .map((t) => t.order.id);
    let ordersMap: Record<number, Order> = {};
    if (orderIds.length > 0) {
      const orders = await this.orderRepository.findByIds(orderIds);
      ordersMap = orders.reduce((acc, order) => {
        acc[order.id] = order;
        return acc;
      }, {} as Record<number, Order>);
    }

    // Collect all unique productIds from all order items
    const productIdSet = new Set<number>();
    Object.values(ordersMap).forEach((order) => {
      (order.items || []).forEach((item) => {
        const pid = Number(item.productId);
        if (!isNaN(pid)) productIdSet.add(pid);
      });
    });
    let productNameMap: Record<number, string> = {};
    if (productIdSet.size > 0) {
      const products = await this.productRepository.findByIds(Array.from(productIdSet));
      productNameMap = products.reduce((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {} as Record<number, string>);
    }

    return transactions.map((t) => {
      let orderDetails: OrderDetailsDto | undefined = undefined;
      if (t.order && ordersMap[t.order.id]) {
        const order = ordersMap[t.order.id];
        orderDetails = {
          orderId: order.id,
          products: (order.items || []).map((item) => ({
            productId: Number(item.productId),
            name: productNameMap[Number(item.productId)] || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            productType: item.productType,
          })),
        };
      }
      return {
        id: t.id,
        amount: t.amount,
        fees: t.fees,
        netAmount: t.netAmount,
        isPayout: t.isPayout,
        payoutDate: t.payoutDate,
        status: t.status,
        createdAt: t.createdAt,
        orderId: t.order ? t.order.id : undefined,
        associationName: t.association ? t.association.name_association : undefined,
        orderDetails,
      };
    });
  }

  async createTransaction(
    createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    if (!createTransactionDto.associationId) {
      this.logger.error(
        'Missing associationId when creating transaction',
        createTransactionDto,
      );
      throw new Error('Association ID is required for transaction creation');
    }

    const transaction = this.transactionRepository.create({
      ...createTransactionDto,
      association: { id: createTransactionDto.associationId },
      order: createTransactionDto.orderId
        ? { id: createTransactionDto.orderId }
        : null,
    });

    return this.transactionRepository.save(transaction);
  }

  async createPayout(createPayoutDto: CreatePayoutDto): Promise<Transaction> {
    const { amount, associationId } = createPayoutDto;

    const transaction = this.transactionRepository.create({
      amount,
      netAmount: amount,
      association: { id: associationId },
      isPayout: true,
      payoutDate: new Date(),
      status: 'completed',
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    const transactionWithAssociation = await this.transactionRepository.findOne(
      {
        where: { id: savedTransaction.id },
        relations: ['association'],
      },
    );

    if (transactionWithAssociation?.association) {
      const { association } = transactionWithAssociation;

      try {
        await this.mailService.sendTransactionalEmail(
          association.email,
          this.mailService.TEMPLATE_ID_BY_SERVICE['PAYOUT_CONFIRMATION'],
          {
            amount: `${amount.toString()}€`,
            association_name: association.name_association,
          },
        );
        this.logger.log(`Payout email sent to ${association.email}`);
      } catch (error) {
        this.logger.error(
          `Failed to send payout email to ${association.email}: ${error.message}`,
        );
      }
    }

    return savedTransaction;
  }

  async getTransactionHistory(
    filterDto: TransactionFilterDto,
  ): Promise<PaginatedResponse<TransactionHistoryItemDto>> {
    const {
      page = 1,
      limit = 10,
      associationId,
      startDate,
      endDate,
    } = filterDto;

    const queryBuilder =
      this.transactionRepository.createQueryBuilder('transaction');

    queryBuilder.leftJoinAndSelect('transaction.association', 'association');
    queryBuilder.leftJoinAndSelect('transaction.order', 'order');
    if (associationId) {
      queryBuilder.andWhere('association.id = :associationId', {
        associationId,
      });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'transaction.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    } else if (startDate) {
      queryBuilder.andWhere('transaction.createdAt >= :startDate', {
        startDate,
      });
    } else if (endDate) {
      queryBuilder.andWhere('transaction.createdAt <= :endDate', { endDate });
    }

    queryBuilder.orderBy('transaction.createdAt', 'DESC');
    queryBuilder.take(limit);
    queryBuilder.skip((page - 1) * limit);

    const [transactions, total] = await queryBuilder.getManyAndCount();

    // Fetch order details for all transactions with an order
    const orderIds = transactions
      .filter((t) => t.order)
      .map((t) => t.order.id);
    let ordersMap: Record<number, Order> = {};
    if (orderIds.length > 0) {
      const orders = await this.orderRepository.findByIds(orderIds);
      ordersMap = orders.reduce((acc, order) => {
        acc[order.id] = order;
        return acc;
      }, {} as Record<number, Order>);
    }

    // Collect all unique productIds from all order items
    const productIdSet = new Set<number>();
    Object.values(ordersMap).forEach((order) => {
      (order.items || []).forEach((item) => {
        const pid = Number(item.productId);
        if (!isNaN(pid)) productIdSet.add(pid);
      });
    });
    let productNameMap: Record<number, string> = {};
    if (productIdSet.size > 0) {
      const products = await this.productRepository.findByIds(Array.from(productIdSet));
      productNameMap = products.reduce((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {} as Record<number, string>);
    }

    const items: TransactionHistoryItemDto[] = transactions.map((t) => {
      let orderDetails: OrderDetailsDto | undefined = undefined;
      if (t.order && ordersMap[t.order.id]) {
        const order = ordersMap[t.order.id];
        orderDetails = {
          orderId: order.id,
          products: (order.items || []).map((item) => ({
            productId: Number(item.productId),
            name: productNameMap[Number(item.productId)] || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            productType: item.productType,
          })),
        };
      }
      return {
        id: t.id,
        amount: t.amount,
        fees: t.fees,
        netAmount: t.netAmount,
        isPayout: t.isPayout,
        payoutDate: t.payoutDate,
        status: t.status,
        createdAt: t.createdAt,
        orderId: t.order ? t.order.id : undefined,
        associationName: t.association ? t.association.name_association : undefined,
        orderDetails,
      };
    });

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

  async getAssociationTransactions(
    associationId: number,
    filterDto: TransactionFilterDto,
  ): Promise<PaginatedResponse<Transaction>> {
    const { page = 1, limit = 10, startDate, endDate } = filterDto;

    const queryBuilder =
      this.transactionRepository.createQueryBuilder('transaction');
    queryBuilder.leftJoinAndSelect('transaction.association', 'association');
    queryBuilder.where('association.id = :associationId', { associationId });

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'transaction.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    } else if (startDate) {
      queryBuilder.andWhere('transaction.createdAt >= :startDate', {
        startDate,
      });
    } else if (endDate) {
      queryBuilder.andWhere('transaction.createdAt <= :endDate', { endDate });
    }

    queryBuilder.orderBy('transaction.createdAt', 'DESC');
    queryBuilder.take(limit);
    queryBuilder.skip((page - 1) * limit);

    const [transactions, total] = await queryBuilder.getManyAndCount();

    return {
      items: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAssociationOverview(associationId: number): Promise<{
    totalIncome: number;
    totalPayouts: number;
    balance: number;
    recentTransactions: Transaction[];
  }> {
    const incomeResult = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.netAmount)', 'total')
      .leftJoin('transaction.association', 'association')
      .where('association.id = :associationId', { associationId })
      .andWhere('transaction.isPayout = :isPayout', { isPayout: false })
      .getRawOne();

    const payoutsResult = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .leftJoin('transaction.association', 'association')
      .where('association.id = :associationId', { associationId })
      .andWhere('transaction.isPayout = :isPayout', { isPayout: true })
      .getRawOne();

    const totalIncome = Number(incomeResult?.total || 0);
    const totalPayouts = Number(payoutsResult?.total || 0);

    const recentTransactions = await this.transactionRepository.find({
      where: { association: { id: associationId } },
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['association'],
    });

    return {
      totalIncome,
      totalPayouts,
      balance: totalIncome - totalPayouts,
      recentTransactions,
    };
  }

  async exportAssociationTransactionsToCSV(
    associationId: number,
  ): Promise<string> {
    const queryBuilder = this.transactionRepository.createQueryBuilder('transaction');

    queryBuilder.leftJoinAndSelect('transaction.association', 'association');
    queryBuilder.leftJoinAndSelect('transaction.order', 'order');
    queryBuilder.leftJoinAndSelect('order.user', 'purchaser');
    queryBuilder.where('association.id = :associationId', { associationId });

    queryBuilder.orderBy('transaction.createdAt', 'DESC');
    const transactions = await queryBuilder.getMany();

    // Get all order IDs for fetching complete order data
    const orderIds = transactions
      .filter((t) => t.order)
      .map((t) => t.order.id);

    let ordersMap: Record<number, Order> = {};
    if (orderIds.length > 0) {
      const orders = await this.orderRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.user', 'user')
        .where('order.id IN (:...orderIds)', { orderIds })
        .getMany();

      ordersMap = orders.reduce((acc, order) => {
        acc[order.id] = order;
        return acc;
      }, {} as Record<number, Order>);
    }

    // Get product names for all products in orders
    const productIdSet = new Set<number>();
    Object.values(ordersMap).forEach((order) => {
      (order.items || []).forEach((item) => {
        const pid = Number(item.productId);
        if (!isNaN(pid)) productIdSet.add(pid);
      });
    });

    let productNameMap: Record<number, string> = {};
    if (productIdSet.size > 0) {
      const products = await this.productRepository
        .createQueryBuilder('product')
        .where('product.id IN (:...productIds)', { productIds: Array.from(productIdSet) })
        .getMany();

      productNameMap = products.reduce((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {} as Record<number, string>);
    }

    // Generate CSV
    const headers = [
      'ID Transaction',
      'Date d\'achat',
      'Montant',
      'Frais',
      'Montant net',
      'Statut',
      'ID Commande',
      'Nom acheteur',
      'Email acheteur',
      'Adresse de livraison',
      'Ville de livraison',
      'Code postal de livraison',
      'Pays de livraison',
      'État/Région de livraison',
      'Produits',
      'Types de produits',
      'Quantités',
      'Prix unitaires',
      'Prix totaux'
    ];

    const csvRows = [headers.join(',')];

    transactions.forEach((transaction) => {
      const order = transaction.order ? ordersMap[transaction.order.id] : null;
      const purchaser = order?.user;

      // Build product information
      let products = '';
      let productTypes = '';
      let quantities = '';
      let unitPrices = '';
      let totalPrices = '';

      if (order?.items) {
        products = order.items
          .map((item) => productNameMap[Number(item.productId)] || `Product ${item.productId}`)
          .join(' | ');
        productTypes = order.items.map((item) => item.productType).join(' | ');
        quantities = order.items.map((item) => item.quantity).join(' | ');
        unitPrices = order.items.map((item) => item.unitPrice).join(' | ');
        totalPrices = order.items.map((item) => item.totalPrice).join(' | ');
      }

      const row = [
        transaction.id,
        transaction.createdAt.toISOString().split('T')[0],
        transaction.amount || '',
        transaction.fees || '',
        transaction.netAmount || '',
        transaction.status || '',
        order?.id || '',
        purchaser ? `${purchaser.name || ''} ${purchaser.lastname || ''}`.trim() :
                   order ? `${order.firstname || ''} ${order.lastname || ''}`.trim() : '',
        purchaser?.email || order?.user?.email || '',
        order?.delivery_address || '',
        order?.delivery_city || '',
        order?.delivery_postalcode || '',
        order?.delivery_country || '',
        order?.delivery_state || '',
        products,
        productTypes,
        quantities,
        unitPrices,
        totalPrices
      ];

      // Escape commas and quotes in CSV values
      const escapedRow = row.map((field) => {
        const stringField = String(field || '');
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
          return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
      });

      csvRows.push(escapedRow.join(','));
    });

    return csvRows.join('\n');
  }
}
