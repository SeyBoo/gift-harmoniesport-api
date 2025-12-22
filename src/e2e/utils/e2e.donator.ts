import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { CreateDonorDto } from '../../users/dto/create-donor.dto';
import { User } from '../../users/entities/user.entity';
import { UserType, UserTypeEnum } from '../../users/entities/user-type.entity';
import {
  Thematic,
  ThematicList,
} from '../../thematics/entities/thematic.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../payment/entities/order.entity';
import { Product } from '../../products/entities/product.entity';
import { DELIVERY_STATUS } from '../../payment/entities/order.entity';
import { UserProduct } from '../../products/entities/userproduct.entity';

@Injectable()
export class E2EDonatorService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(UserType)
    private readonly userTypeRepository: Repository<UserType>,
    @InjectRepository(Thematic)
    private readonly thematicRepository: Repository<Thematic>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(UserProduct)
    private readonly userProductRepository: Repository<UserProduct>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async createDonator(email: string): Promise<User> {
    const userType = await this.userTypeRepository.findOne({
      where: { name: UserTypeEnum.DONATEUR },
    });
    const thematic = await this.thematicRepository.findOne({
      where: { name: ThematicList.HUMANITARIAN },
    });

    const defaultData: CreateDonorDto = {
      name: 'Test',
      lastname: 'Donator',
      address: '123 Test St',
      email,
      password: 'Test123!',
      thematic,
      userType,
      termsAcceptedAt: new Date(),
    };

    return await this.usersService.createDonor(defaultData);
  }

  async deleteDonator(email: string): Promise<void> {
    if (email.includes("test")) {
      const donor = await this.usersService.findOneByEmail(email);
      await this.usersService.delete(donor);
    }

  }

  async createOrder(donatorEmail: string): Promise<Order> {
    const donor = await this.usersService.findOneByEmail(donatorEmail);

    const product = await this.productRepository.findOne({});

    // Create the order without the product relation
    const order = await this.orderRepository.create({
      userId: donor.id.toString(),
      price: '1000',
      items: [{ 
        productId: product.id.toString(), 
        quantity: 1, 
        unitPrice: '1000',
        totalPrice: '1000',
        productType: 'collector' 
      }],
      paymentIntentId: 'test_payment_intent',
      status: 'completed',
      delivery_status: DELIVERY_STATUS.PENDING,
    });

    // Save order first
    const savedOrder = await this.orderRepository.save(order);

    // Create user product relation
    const userProduct = await this.userProductRepository.create({
      user: donor,
      product,
      order: savedOrder,
    });
    await this.userProductRepository.save(userProduct);

    return savedOrder;
  }
}
