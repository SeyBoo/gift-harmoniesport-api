import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserTypeIdByName } from '../../users/entities/user.entity';
import { Thematic } from '../../thematics/entities/thematic.entity';
import { UserType } from '../../users/entities/user-type.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../payment/entities/order.entity';
import { UserProduct } from '../../products/entities/userproduct.entity';

@Injectable()
export class E2EAssociationsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Thematic)
    private readonly thematicRepository: Repository<Thematic>,
    @InjectRepository(UserType)
    private readonly userTypeRepository: Repository<UserType>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(UserProduct)
    private readonly userProductRepository: Repository<UserProduct>,
  ) {}

  async createAssociation(data: Partial<User> = {}) {
    const associationType = await this.userTypeRepository.findOne({
      where: { id: UserTypeIdByName.association },
    });

    const thematic = await this.thematicRepository.findOne({
      where: {},
    });

    const association = this.userRepository.create({
      name: 'Test Association',
      lastname: 'Test',
      address: '123 Test St',
      email: `test.association.${Date.now()}@test.com`,
      password: 'test123',
      site_internet: 'https://test.com',
      description: 'Test association description',
      reference: `TEST-${Date.now()}`,
      rib: 'FR7630006000011234567890189',
      name_association: 'Test Association',
      logo: 'https://test.com/logo.png',
      activation_key: 'test123',
      user_status: true,
      color_asso: '#FF0000',
      thematic,
      userType: associationType,
      ...data,
    });

    return this.userRepository.save(association);
  }

  async createDonor(data: Partial<User> = {}) {
    const donorType = await this.userTypeRepository.findOne({
      where: { id: UserTypeIdByName.donateur },
    });

    const thematic = await this.thematicRepository.findOne({
      where: {},
    });

    const donor = this.userRepository.create({
      name: 'Test Donor',
      lastname: 'Test',
      address: '123 Test St',
      email: `test.donor.${Date.now()}@test.com`,
      password: 'test123',
      thematic,
      userType: donorType,
      ...data,
    });

    return this.userRepository.save(donor);
  }

  async createCampaign(association: User, data: Partial<Campaign> = {}) {
    const campaign = this.campaignRepository.create({
      campagne_name: 'Test Campaign',
      description: 'Test campaign description',
      date_start: new Date(),
      date_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      user: association,
      ...data,
    });

    return this.campaignRepository.save(campaign);
  }

  async createProduct(campaign: Campaign, data: Partial<Product> = {}) {
    const product = this.productRepository.create({
      name: 'Test Product',
      price: {
        'bundle-premium': 1000,
        'bundle-plus': 500,
        'bundle-basic': 100,
        'bundle-digital': 50,
      },
      currency: 'EUR',
      image: 'https://test.com/product.png',
      message_donation: 'Thank you for your donation!',
      message_celebrity: 'Thank you from the celebrity!',
      campaign,
      ...data,
    });

    return this.productRepository.save(product);
  }
}
