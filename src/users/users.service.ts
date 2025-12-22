import { TranslatorService } from './../common/translator/translator.service';
import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsRelations,
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserTypeIdByName } from './entities/user.entity';
import { FISC_STATUS, Order } from '../payment/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { UserType, UserTypeEnum } from './entities/user-type.entity';
import { UserProduct } from '../products/entities/userproduct.entity';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Label } from './entities/label.entity';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { ListAssociationsDto } from '../common/dtos/admin/association.dto';
import {
  UserAffiliation,
  DEFAULT_EARNING_PERCENTAGE_DONOR,
  DEFAULT_EARNING_PERCENTAGE_ASSOCIATION,
  EXPIRATION_AFFILIATION_TIME_MS,
} from './entities/user-affiliation.entity';
import { UserTransaction } from './entities/user-transaction.entity';
import {
  UserWithdrawal,
  WithdrawalStatus,
} from './entities/user-withdrawal.entity';
import { AssociationDescription } from './types/users.interface';
import { OpenAI } from 'openai';
import { HttpService } from '@nestjs/axios';
import { TransactionsService } from '../transactions/transactions.service';
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private openai: OpenAI;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProduct)
    private readonly userProductRepository: Repository<UserProduct>,
    @InjectRepository(UserType)
    private readonly userTypeRepository: Repository<UserType>,
    @InjectRepository(UserAffiliation)
    private readonly userAffiliationRepository: Repository<UserAffiliation>,
    @InjectRepository(UserTransaction)
    private readonly userTransactionRepository: Repository<UserTransaction>,
    @InjectRepository(UserWithdrawal)
    private readonly userWithdrawalRepository: Repository<UserWithdrawal>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Label)
    private readonly labelRepository: Repository<Label>,
    private readonly translatorService: TranslatorService,
    private jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly transactionsService: TransactionsService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  async delete(user: User) {
    // Find related entities that need to be handled before deletion
    const queryRunner =
      this.userRepository.manager.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Delete related wallet records first
      await queryRunner.manager.query('DELETE FROM wallet WHERE user_id = ?', [
        user.id,
      ]);

      // Then delete the user
      await queryRunner.manager.delete(User, { id: user.id });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new HttpException(
        `Failed to delete user: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async getUserTypes() {
    return await this.userTypeRepository.find();
  }

  async findAssosNames(ids: number[]) {
    return await this.userRepository.find({
      where: { id: In(ids) },
      select: ['name_association'],
    });
  }

  async generateAssociationDescription(
    description: string,
  ): Promise<AssociationDescription> {
    if (description === '') {
      return {
        shorten_description: undefined,
        fond_usage_description: undefined,
        mission_description: undefined,
      };
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: "You're an expert at copywriting.",
        },
        {
          role: 'user',
          content: `Based on this description: "${description}", return to me a valid JSON object only containing the keys {shorten_description, mission_description, fond_usage_description} the following value based on the provided description.`,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    function sanitizeJsonResponse(rawContent: string): string {
      let sanitizedContent = rawContent.trim();
      sanitizedContent = sanitizedContent.replace(/```json/g, '');
      sanitizedContent = sanitizedContent.replace(/```/g, '');

      sanitizedContent = sanitizedContent.replace(/[\r\n]+/g, ' ');

      const firstBrace = sanitizedContent.indexOf('{');
      const lastBrace = sanitizedContent.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('Invalid JSON: Missing opening or closing braces.');
      }

      sanitizedContent = sanitizedContent.slice(firstBrace, lastBrace + 1);

      return sanitizedContent;
    }

    let parsedResult;
    try {
      const cleanContent = sanitizeJsonResponse(
        response.choices[0].message?.content,
      );
      parsedResult = JSON.parse(cleanContent);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      console.error(
        'Invalid JSON from OpenAI:',
        response.choices[0].message?.content,
      );
      throw new Error(
        'Failed to parse OpenAI response. Ensure the API returns valid JSON.',
      );
    }

    const shorten_description = await this.translatorService.translateAll(
      parsedResult['shorten_description'],
      'en',
    );
    const mission_description = await this.translatorService.translateAll(
      parsedResult['mission_description'],
      'en',
    );
    const fond_usage_description = await this.translatorService.translateAll(
      parsedResult['fond_usage_description'],
      'en',
    );

    return {
      shorten_description,
      fond_usage_description,
      mission_description,
    };
  }

  async doesSlugExist(slug: string): Promise<boolean> {
    const existingUser = await this.userRepository.findOne({
      where: { slug },
    });
    return !!existingUser;
  }

  async generateUniqueSlug(user: Partial<User>): Promise<string> {
    if (!user.name_association) {
      return null;
    }
    const baseSlug = user?.name_association
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let uniqueSlug = baseSlug;
    let counter = 0;
    const maxRetries = 100;

    while (await this.doesSlugExist(uniqueSlug)) {
      counter++;
      if (counter > maxRetries) {
        throw new Error(
          `Unable to generate a unique slug for "${name}" after ${maxRetries} attempts.`,
        );
      }
      uniqueSlug = `${baseSlug}-${counter}`;
    }

    return uniqueSlug;
  }

  async createAssociation(userDto: Partial<User>) {
    userDto.activation_key = '';
    userDto.user_status = true;
    const paswwordHashed = await this.hashPassword(userDto.password);
    userDto.password = paswwordHashed;
    if (!userDto.slug) {
      try {
        userDto.slug = await this.generateUniqueSlug(userDto);
      } catch (e) {
        this.logger.error(e);
      }
    }
    const user = this.userRepository.create(userDto);
    return this.userRepository.save(user).catch((err) => {
      throw new HttpException(
        {
          message: err.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    });
  }

  async createDonor(userDto: CreateDonorDto) {
    const paswwordHashed = await this.hashPassword(userDto.password);
    userDto.password = paswwordHashed;
    const user = this.userRepository.create(userDto);
    return this.userRepository.save(user).catch((err) => {
      this.logger.error(err);
      console.log('err', err);
      throw new HttpException(
        {
          message: err.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    });
  }

  async updateDonor(id: number, userDto: UpdateDonorDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new HttpException(
        { message: 'User not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    const updatedUser = { ...user, ...userDto };
    return this.userRepository.save(updatedUser).catch((err) => {
      throw new HttpException(
        {
          message: err.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    });
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10; // nombre de tours de salage
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return await hashedPassword;
  }

  async comparePasswords(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  findAll() {
    return `This action returns all users`;
  }

  async findOne(id: number): Promise<User | undefined> {
    return await this.userRepository.findOne({
      where: { id },
      relations: ['thematic', 'userType'],
    });
  }

  async findMessageAsso(id: number) {
    const a = await this.userProductRepository
      .createQueryBuilder('up')
      .innerJoin(Product, 'p', 'up.product_id = p.id')
      .innerJoin(Campaign, 'c', 'p.campaign_id = c.id')
      .innerJoin(User, 'u', 'c.user_id = u.id')
      .innerJoin(User, 'udon', 'up.user_id = udon.id')
      .innerJoin(Order, 'o', 'up.order_id = o.id')
      .select([
        'up.id',
        'o.message',
        'o.video',
        'o.created_at',
        'udon.name',
        'udon.lastname',
      ])
      .where('c.user_id = :id', { id })
      .getRawMany();

    return a;
  }

  async findFiscAsso(id: number) {
    const a = await this.userProductRepository
      .createQueryBuilder('up')
      .innerJoin(Product, 'p', 'up.product_id = p.id')
      .innerJoin(Campaign, 'c', 'p.campaign_id = c.id')
      .innerJoin(User, 'u', 'c.user_id = u.id')
      .innerJoin(User, 'udon', 'up.user_id = udon.id')
      .innerJoin(Order, 'o', 'up.order_id = o.id')
      .select([
        'up.id',
        'o.message',
        'o.video',
        'o.created_at',
        'udon.name',
        'udon.lastname',
        'o.items',
        'o.invoice_phone',
        'o.invoice_address',
        'o.invoice_address_information',
        'o.invoice_postalcode',
        'o.invoice_city',
        'o.invoice_country',
        'o.invoice_state',
        'o.fisc_status',
        'o.reference',
      ])
      .where('c.user_id = :id', { id })
      .getRawMany();

    return a;
  }

  async findFiscDonation(id: number) {
    const userOrders = await this.orderRepository.find({
      where: {
        user: {
          id,
        },
      },
    });

    return this.transactionsService.findAll({
      order: {
        id: In(userOrders.map((order) => order.id)),
      },
    });
  }

  async findOneByEmailSimple(email: string): Promise<User> {
    return await this.userRepository.findOne({
      where: { email },
    });
  }

  async findOneCustomByAsso(identifier: string): Promise<User> {
    const id = parseInt(identifier, 10);
    return await this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.color_asso',
        'user.logo',
        'user.name_association',
        'user.slug',
        'user.mission_description',
        'user.shorten_description',
        'user.fond_usage_description',
        'user.site_internet',
        'thematic.id',
        'thematic.name',
        'thematic.label',
        'thematic.multilingualName', // Updated to match the property name in the Thematic entity
      ])
      .leftJoin('user.thematic', 'thematic')
      .where([
        { id: !isNaN(id) ? id : undefined },
        { slug: isNaN(id) ? identifier : undefined },
      ])
      .getOne();
  }

  async findOneCustomByCard(slug: string): Promise<User> {
    return await this.productRepository
      .createQueryBuilder('p')
      .innerJoin(Campaign, 'c', 'c.id = p.campaign_id')
      .innerJoin(User, 'u', 'u.id = c.user_id')
      .select(['color_asso', 'logo', 'name_association'])
      .where('p.slug = :slug', { slug })
      .getRawOne();
  }

  async findOneByTokenPass(token: string): Promise<User> {
    return await this.userRepository.findOne({
      where: { token_pass: token },
    });
  }

  async findOneByEmail(email: string): Promise<User> {
    return await this.userRepository.findOne({
      where: { email },
      relations: ['thematic', 'userType'],
    });
  }

  async fetchDonorData(id: number) {
    return await this.userRepository.findOne({
      where: { id },
    });
  }

  async addReceipt(idUser: number, reference: string, receipt: string) {
    try {
      const order = await this.orderRepository.findOne({
        where: { reference },
      });
      order.fisc_file = receipt;
      order.fisc_status = FISC_STATUS.COMPLETED;
      const o = await this.orderRepository.save(order);
      return o;
    } catch (error) {
      throw new Error(`Failed to update order: ${error.message}`);
    }
  }

  async refuseReceipt(idUser: number, reference: string) {
    try {
      const order = await this.orderRepository.findOne({
        where: { reference },
      });
      order.fisc_status = FISC_STATUS.REFUSED;
      const o = await this.orderRepository.save(order);
      return o;
    } catch (error) {
      throw new Error(`Failed to update order: ${error.message}`);
    }
  }

  async updateUser(id: number, updateUserDto: Partial<User>): Promise<User> {
    await this.userRepository.update(id, updateUserDto);
    return await this.userRepository.findOne({ where: { id } });
  }

  async updateProfile(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        throw new Error('User not found');
      }

      // Update user's profile data
      if (updateUserDto.name) user.name = updateUserDto.name;
      if (updateUserDto.lastname) user.lastname = updateUserDto.lastname;
      if (updateUserDto.address) user.address = updateUserDto.address;
      if (updateUserDto.email) user.email = updateUserDto.email;
      if (updateUserDto.description)
        user.description = updateUserDto.description;
      if (updateUserDto.reference) user.reference = updateUserDto.reference;
      if (updateUserDto.rib) user.rib = updateUserDto.rib;
      if (updateUserDto.name_association)
        user.name_association = updateUserDto.name_association;
      if (updateUserDto.logo != 'undefined') {
        user.logo = updateUserDto.logo;
      }
      if (updateUserDto.site_internet)
        user.site_internet = updateUserDto.site_internet;
      if (updateUserDto.contact_name)
        user.contact_name = updateUserDto.contact_name;
      if (updateUserDto.color_asso) user.color_asso = updateUserDto.color_asso;
      if (updateUserDto.facebookLink) user.facebookLink = updateUserDto.facebookLink;
      if (updateUserDto.instagramLink) user.instagramLink = updateUserDto.instagramLink;
      if (updateUserDto.twitterLink) user.twitterLink = updateUserDto.twitterLink;
      if (updateUserDto.tiktokLink) user.tiktokLink = updateUserDto.tiktokLink;
      if (updateUserDto.linkedinLink) user.linkedinLink = updateUserDto.linkedinLink;
      if (updateUserDto.description) {
        user.description = updateUserDto.description;

        const {
          fond_usage_description,
          mission_description,
          shorten_description,
        } = await this.generateAssociationDescription(
          updateUserDto.description,
        );

        user.fond_usage_description = fond_usage_description;
        user.mission_description = mission_description;
        user.shorten_description = shorten_description;
      }

      // Add more fields as needed
      // await this.jwtService.signAsync(updateUserDto);
      // console.log(  JSON.stringify(updateUserDto))
      // const payload = {
      //   email: updateUserDto.email,
      //   contact_name: updateUserDto.contact_name,
      //   address: updateUserDto.address,
      //   description: updateUserDto.description,
      //   reference: updateUserDto.reference,
      //   rib: updateUserDto.rib,
      //   name_association: updateUserDto.name_association,
      //   logo: updateUserDto.logo,
      //   site_internet: updateUserDto.site_internet
      // };
      // const newToken = await this.jwtService.signAsync(payload);
      //  console.log("newToken ===== " + newToken)
      //   res.setHeader('Content-Type', 'application/json; charset=utf-8');
      //   res.json({
      //     message: 'Profile updated successfully',
      //     token: newToken,
      //   });
      await this.userRepository.save(user);
      return user;
    } catch (error) {
      throw new Error(`Failed to update profile service: ${error.message}`);
    }
  }

  async updateToken(
    updateUserDto: UpdateUserDto,
  ): Promise<{ access_token: string }> {
    await this.jwtService.signAsync(updateUserDto);
    // console.log(  JSON.stringify(updateUserDto))
    const payload = {
      email: updateUserDto.email,
      contact_name: updateUserDto.contact_name,
      address: updateUserDto.address,
      description: updateUserDto.description,
      reference: updateUserDto.reference,
      rib: updateUserDto.rib,
      name_association: updateUserDto.name_association,
      logo: updateUserDto.logo,
      site_internet: updateUserDto.site_internet,
      // user_type_id: updateUserDto.userType.id
    };
    const newToken = await this.jwtService.signAsync(payload);
    return {
      access_token: newToken,
    };
  }

  async update(id: number, updateUserDto: Partial<User>) {
    return await this.userRepository.update(id, updateUserDto);
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async findAllMyAssociations(limit?: number) {
    if (limit) {
      return await this.userRepository.query(`
        SELECT * FROM user WHERE user_type_id = 1 limit ${limit}`);
    } else {
      return await this.userRepository.query(`
        SELECT * FROM user WHERE user_type_id = 1`);
    }
  }

  async dashboardResume(id: number) {
    const a = await this.userRepository
      .createQueryBuilder('u')
      .innerJoin(Campaign, 'c', 'c.user_id = u.id')
      .select('COUNT(c.id)', 'campaignCount')
      .where('c.user_id = :id', { id })
      .getRawOne();

    const b = await this.userRepository
      .createQueryBuilder('u')
      .innerJoin(UserProduct, 'up', 'up.user_id = u.id')
      .innerJoin(Product, 'p', 'up.product_id = p.id')
      .innerJoin(Campaign, 'c', 'p.campaign_id = c.id')
      .select('COUNT(up.id)', 'donationCount')
      .where('c.user_id = :id and up.order_id IS NOT NULL', { id })
      .getRawOne();

    const c = await this.userProductRepository
      .createQueryBuilder('up')
      .innerJoin(Product, 'p', 'up.product_id = p.id')
      .innerJoin(Campaign, 'c', 'p.campaign_id = c.id')
      .select('SUM(p.price)', 'donationObjectifCount')
      .where('c.user_id = :id', { id })
      .getRawOne();

    const d = await this.userProductRepository
      .createQueryBuilder('up')
      .innerJoin(Product, 'p', 'up.product_id = p.id')
      .innerJoin(Campaign, 'c', 'p.campaign_id = c.id')
      .select('SUM(p.price)', 'donationPaidCount')
      .where('c.user_id = :id and up.order_id IS NOT NULL', { id })
      .getRawOne();

    return {
      campaignCount: a.campaignCount || 0,
      donationCount: b.donationCount || 0,
      donationObjectifCount: c.donationObjectifCount || 0,
      donationPaidCount: d.donationPaidCount || 0,
    };
  }

  async getLabels(
    options: FindOptionsWhere<Label>,
    pagination: PaginationDto,
  ): Promise<[Label[], number]> {
    const { page, limit } = pagination;
    return await this.labelRepository.findAndCount({
      where: options,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      select: ['id', 'name', 'imageUrl'],
    });
  }

  async findAnUserType(options: FindOptionsWhere<UserType>): Promise<UserType> {
    return await this.userTypeRepository.findOneOrFail({
      where: options,
    });
  }

  async findAnUser(options: FindOptionsWhere<User>): Promise<User> {
    try {
      return await this.userRepository.findOneOrFail({
        where: options,
      });
    } catch (e) {
      throw new NotFoundException(e);
    }
  }

  async createUserAffiliation(
    data: Partial<UserAffiliation>,
  ): Promise<UserAffiliation> {
    // Look up the affiliated user to determine their type
    const affiliatedUser = await this.userRepository.findOne({
      where: { id: data.affiliatedUserId },
      relations: ['userType'],
    });

    const isAssociation =
      affiliatedUser?.userType?.id === UserTypeIdByName.association;

    // Set defaults based on user type
    const affiliationData: Partial<UserAffiliation> = {
      ...data,
      earningPercentage:
        data.earningPercentage ??
        (isAssociation
          ? DEFAULT_EARNING_PERCENTAGE_ASSOCIATION
          : DEFAULT_EARNING_PERCENTAGE_DONOR),
      expiredAt: isAssociation
        ? null // Permanent for associations
        : new Date(Date.now() + EXPIRATION_AFFILIATION_TIME_MS), // 1 year for donors
    };

    const userAffiliate = this.userAffiliationRepository.create(affiliationData);
    return await this.userAffiliationRepository.save(userAffiliate);
  }

  async findUserAffiliations(
    options:
      | FindOptionsWhere<UserAffiliation>
      | FindOptionsWhere<UserAffiliation>[],
  ): Promise<UserAffiliation[]> {
    return await this.userAffiliationRepository.find({
      where: options,
      relations: ['affiliatedUser'],
    });
  }

  async findUser(options: FindOptionsWhere<User>): Promise<User[]> {
    return await this.userRepository.find({
      where: options,
    });
  }

  async createUserBulkTransaction(
    datas: Partial<UserTransaction>[],
  ): Promise<UserTransaction[]> {
    const userTransaction = this.userTransactionRepository.create(datas);
    return await this.userTransactionRepository.save(userTransaction);
  }

  async seedUserWithoutAffiliation() {
    const usersWithoutAffiliationCode = await this.userRepository.find({
      where: { affiliationCode: null },
    });

    usersWithoutAffiliationCode.forEach((user) => {
      user.generateAffiliationCode();
    });

    await this.userRepository.save(usersWithoutAffiliationCode);
  }

  async getUserAffiliationStats(userId: number): Promise<{
    affiliationCode: string;
    countAffiliated: number;
    amountCollected: number;
    amountToCollect: number;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['affiliationCode'], // Select only the affiliationCode to avoid loading unnecessary data
    });

    if (!user) {
      throw new NotFoundException();
    }
    const countAffiliated = await this.userAffiliationRepository.count({
      where: { affiliateUserId: userId },
    });

    const amountCollected = await this.userTransactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.userAffiliation', 'affiliation')
      .where('affiliation.affiliateUserId = :userId', { userId })
      .andWhere('transaction.withdrawalId IS NOT NULL')
      .select('SUM(transaction.amount)', 'sum')
      .getRawOne();

    const amountToCollect = await this.getUserBalance(userId);

    return {
      affiliationCode: user.affiliationCode,
      countAffiliated,
      amountCollected: Number(amountCollected?.sum) || 0,
      amountToCollect,
    };
  }

  async getUserTransaction(
    options: FindOptionsWhere<UserTransaction>,
    pagination: PaginationDto,
    attributes: (keyof UserTransaction)[],
    relations?: FindOptionsRelations<UserTransaction>,
  ): Promise<[UserTransaction[], number]> {
    const { page, limit } = pagination;
    return await this.userTransactionRepository.findAndCount({
      where: options,
      take: limit,
      skip: (page - 1) * limit,
      select: attributes,
      relations,
    });
  }
  async getAffiliationDataByAssociation(userId: number): Promise<
    {
      associationName: string;
      cardSoldCount: number;
      totalAmountCollected: number;
    }[]
  > {
    // Get all affiliations where this user is the affiliate and the affiliated user is an association
    return (
      await this.userTransactionRepository
        .createQueryBuilder('ut')
        .innerJoin('ut.userAffiliation', 'ua')
        .innerJoin('ua.affiliatedUser', 'affiliated_user')
        .select('affiliated_user.name_association', 'associationName')
        .addSelect('COUNT(ut.id)', 'cardSoldCount')
        .addSelect('SUM(ut.amount)', 'totalAmountCollected')
        .where('ua.affiliate_user_id = :userId', { userId })
        .andWhere('affiliated_user.user_type_id = :userType', {
          userType: UserTypeIdByName.association,
        })
        .groupBy('affiliated_user.id')
        .getRawMany()
    ).map((e) => ({
      ...e,
      cardSoldCount: Number(e.cardSoldCount ?? 0),
      totalAmountCollected: Number(e.totalAmountCollected ?? 0),
    }));
  }

  async getAffiliationDataByDonor(userId: number): Promise<{
    countAffiliated: number;
    cardSoldCount: number;
    totalAmountCollected: number;
  }> {
    return {
      countAffiliated: await this.userAffiliationRepository.count({
        where: {
          affiliateUserId: userId,
          affiliatedUser: {
            userType: {
              id: UserTypeIdByName.donateur,
            },
          },
        },
      }),
      cardSoldCount: await this.userTransactionRepository.count({
        where: {
          userAffiliation: {
            affiliateUserId: userId,
            affiliatedUser: {
              userType: {
                id: UserTypeIdByName.donateur,
              },
            },
          },
        },
      }),
      totalAmountCollected:
        (await this.userTransactionRepository.sum('amount', {
          userAffiliation: {
            affiliateUserId: userId,
            affiliatedUser: {
              userType: {
                id: UserTypeIdByName.donateur,
              },
            },
          },
        })) ?? 0,
    };
  }

  async getWithdrawal(
    options: FindOptionsWhere<UserWithdrawal>,
    pagination: PaginationDto,
  ): Promise<[UserWithdrawal[], number]> {
    const { page, limit } = pagination;
    return await this.userWithdrawalRepository.findAndCount({
      where: options,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
    });
  }

  async getUserBalance(userId: number): Promise<number> {
    const earnings =
      (await this.userTransactionRepository.sum('amount', {
        userAffiliation: {
          affiliateUserId: userId,
        },
      })) ?? 0;
    const withdrawal =
      (await this.userWithdrawalRepository.sum('amount', {
        userId: userId,
        status: WithdrawalStatus.ACCEPTED,
      })) ?? 0;
    return earnings - withdrawal;
  }

  async getOneWithdrawal(
    options: FindOptionsWhere<UserWithdrawal>,
  ): Promise<UserWithdrawal> {
    return await this.userWithdrawalRepository.findOne({
      where: options,
    });
  }

  async getLatLng(address: string): Promise<{ lat: number; lng: number }> {
    try {
      if (!address) {
        return { lat: 0, lng: 0 };
      }
      const baseUrl = 'https://nominatim.openstreetmap.org/search';
      const encodedAddress = encodeURIComponent(address.replace(/,/g, ''));
      const url = `${baseUrl}?q=${encodedAddress}&format=json&limit=1`;
      const response = await this.httpService.axiosRef.get(url, {
        headers: {
          'User-Agent': 'GiftAsso/1.0 (contact@giftasso.com)',
        },
      });

      if (!response.data.length) {
        return { lat: 0, lng: 0 };
      }

      const { lat, lon } = response.data[0];
      return { lat: parseFloat(lat), lng: parseFloat(lon) };
    } catch (error) {
      console.error('error', error);
      return { lat: 0, lng: 0 };
    }
  }

  async createWithdrawal(
    withdrawal: Partial<UserWithdrawal>,
  ): Promise<UserWithdrawal> {
    const withdrawalEntity = this.userWithdrawalRepository.create(withdrawal);
    await this.userWithdrawalRepository.save(withdrawalEntity);
    return withdrawalEntity;
  }

  async getUsersWithCampaignAndProduct(
    pagination: ListAssociationsDto,
    options: { latitude: number; longitude: number },
    subThematicIds?: string[],
  ): Promise<[Partial<User>[], number]> {
    const { page, limit, search, filter } = pagination;
    const { latitude, longitude } = options;
    const offset = (page - 1) * limit;

    const query = `
      SELECT u.id, u.name, u.name_association, u.site_internet, u.logo, u.slug, u.latitude, u.longitude, u.shorten_description, t.multilingual_name as thematic,
        (6371 * acos(
          cos(radians(?)) * cos(radians(u.latitude)) * cos(radians(u.longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(u.latitude))
        )) AS distance
      FROM user u
      LEFT JOIN campaign c ON c.user_id = u.id
      LEFT JOIN product p ON p.campaign_id = c.id
      LEFT JOIN thematic t ON t.id = u.thematic_id
      WHERE u.user_type_id = ?
        AND u.is_active = true
        ${search ? 'AND u.name_association LIKE ?' : ''}
        ${filter ? 'AND u.thematic_id IN (?)' : ''}
        ${subThematicIds ? 'AND u.sub_thematic_id IN (?)' : ''}
      GROUP BY u.id
      ORDER BY (u.latitude IS NULL OR u.longitude IS NULL) ASC, distance
      LIMIT ? OFFSET ?
    `;

    const queryParams: any[] = [
      latitude,
      longitude,
      latitude,
      UserTypeIdByName.association,
    ];

    if (search) {
      queryParams.push(`%${search}%`);
    }
    if (filter) {
      queryParams.push(filter);
    }
    if (subThematicIds) {
      queryParams.push(subThematicIds);
    }

    queryParams.push(limit, offset);

    const users = await this.userRepository.query(query, queryParams);

    const countQuery = `
      SELECT COUNT(DISTINCT u.id) AS total
      FROM user u
      WHERE u.user_type_id = ?
        AND u.is_active = true
        ${search ? 'AND u.name_association LIKE ?' : ''}
        ${filter ? 'AND u.thematic_id IN (?)' : ''}
        ${subThematicIds ? 'AND u.sub_thematic_id IN (?)' : ''}
    `;

    const countParams: any[] = [UserTypeIdByName.association];

    if (search) {
      countParams.push(`%${search}%`);
    }
    if (filter) {
      countParams.push(filter);
    }
    if (subThematicIds) {
      countParams.push(subThematicIds);
    }

    const countResult = await this.userRepository.query(
      countQuery,
      countParams,
    );
    const total = parseInt(countResult[0].total, 10);

    return [users, total];
  }

  async findByStripeAccountId(stripeAccountId: string): Promise<User> {
    return this.userRepository.findOne({
      where: { stripeAccountId },
    });
  }

  async findByEmail(email: string): Promise<User> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async createGoogleUser(userData: {
    email: string;
    name: string;
    lastname: string;
    picture: string;
  }): Promise<User> {
    const existingUser = await this.findOneByEmail(userData.email);
    if (existingUser) {
      return existingUser;
    }

    // Get donor user type
    const donorType = await this.userTypeRepository.findOne({
      where: { id: UserTypeIdByName[UserTypeEnum.DONATEUR] },
    });

    if (!donorType) {
      throw new Error('Donor user type not found');
    }

    const user = new User({
      email: userData.email,
      name: userData.name,
      lastname: userData.lastname,
      logo: userData.picture, // Store the profile picture as logo
      userType: donorType,
      password: await this.hashPassword(Math.random().toString(36).slice(-16)),
      user_status: true,
      activation_key: null,
      isActive: true,
    });

    return await this.userRepository.save(user);
  }
}
