import {
  ListAffiliationsDto,
  UpdateEarningDto,
  CreateAffiliationDto,
} from '../../common/dtos';
import { UsersService } from '../../users/users.service';
import { UserAffiliation } from '../../users/entities/user-affiliation.entity';
import { UserTransaction } from '../../users/entities/user-transaction.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  ILike,
  LessThanOrEqual,
  MoreThan,
  Repository,
  IsNull,
  Not,
  And,
} from 'typeorm';

@Injectable()
export class UserAffiliationsService {
  constructor(
    @InjectRepository(UserAffiliation)
    private userAffiliationRepository: Repository<UserAffiliation>,
    private readonly usersService: UsersService,
  ) {}

  private calculateTotalEarnings(transactions: UserTransaction[]): number {
    return transactions.reduce((total, transaction) => {
      if (transaction.order && !transaction.userWithdrawal) {
        return total + transaction.amount;
      }
      return total;
    }, 0);
  }

  async findAll(query: ListAffiliationsDto) {
    const { search, status, userType, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const now = new Date();

    let where: FindOptionsWhere<UserAffiliation> | FindOptionsWhere<UserAffiliation>[] = {};

    // Handle status filtering with support for permanent affiliations (null expiry)
    if (status === 'expired') {
      // Expired: has expiry date AND it's in the past (permanent affiliations are never expired)
      where.expiredAt = And(Not(IsNull()), LessThanOrEqual(now));
    } else if (status === 'active') {
      // Active: either permanent (null expiry) OR not yet expired
      where = [
        { expiredAt: IsNull() }, // Permanent affiliations
        { expiredAt: MoreThan(now) }, // Not yet expired
      ];
    }

    // Handle search and userType filters
    if (search || userType) {
      const userFilter: any = {};

      if (search) {
        userFilter.$or = [
          { name: ILike(`%${search}%`) },
          { lastname: ILike(`%${search}%`) },
          { email: ILike(`%${search}%`) },
          { name_association: ILike(`%${search}%`) },
        ];
      }
      if (userType) {
        userFilter.userType = { name: userType };
      }

      // Combine with status filter
      if (Array.isArray(where)) {
        // For active status (array of conditions)
        where = where.map((condition) => ({
          ...condition,
          affiliatedUser: search
            ? [
                { name: ILike(`%${search}%`), ...(userType ? { userType: { name: userType } } : {}) },
                { lastname: ILike(`%${search}%`), ...(userType ? { userType: { name: userType } } : {}) },
                { email: ILike(`%${search}%`), ...(userType ? { userType: { name: userType } } : {}) },
                { name_association: ILike(`%${search}%`), ...(userType ? { userType: { name: userType } } : {}) },
              ]
            : userType
            ? { userType: { name: userType } }
            : {},
        }));
      } else {
        // For expired status or no status filter
        where.affiliatedUser = search
          ? [
              { name: ILike(`%${search}%`), ...(userType ? { userType: { name: userType } } : {}) },
              { lastname: ILike(`%${search}%`), ...(userType ? { userType: { name: userType } } : {}) },
              { email: ILike(`%${search}%`), ...(userType ? { userType: { name: userType } } : {}) },
              { name_association: ILike(`%${search}%`), ...(userType ? { userType: { name: userType } } : {}) },
            ]
          : userType
          ? { userType: { name: userType } }
          : {};
      }
    }

    const [affiliations, total] =
      await this.userAffiliationRepository.findAndCount({
        where,
        relations: {
          affiliateUser: {
            userType: true,
          },
          affiliatedUser: {
            userType: true,
          },
          userTransactions: {
            order: true,
            userWithdrawal: true,
          },
        },
        skip,
        take: limit,
        order: {
          createdAt: 'DESC',
        },
      });

    const results = affiliations.map((affiliation) => ({
      ...affiliation,
      totalEarnings: this.calculateTotalEarnings(affiliation.userTransactions),
      // Permanent affiliations (null expiry) are never expired
      isExpired: affiliation.expiredAt ? new Date(affiliation.expiredAt) <= now : false,
    }));

    return {
      items: results,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateEarning(id: number, updateEarningDto: UpdateEarningDto) {
    const affiliation = await this.userAffiliationRepository.findOne({
      where: { id },
      relations: {
        affiliatedUser: {
          userType: true,
        },
        userTransactions: {
          order: true,
          userWithdrawal: true,
        },
      },
    });

    if (!affiliation) {
      throw new NotFoundException(`User affiliation with ID ${id} not found`);
    }

    affiliation.earningPercentage = updateEarningDto.earningPercentage;

    const savedAffiliation =
      await this.userAffiliationRepository.save(affiliation);
    return {
      ...savedAffiliation,
      totalEarnings: this.calculateTotalEarnings(affiliation.userTransactions),
    };
  }

  async create(createAffiliationDto: CreateAffiliationDto) {
    // Use the UsersService to create the affiliation with proper defaults
    const affiliation = await this.usersService.createUserAffiliation({
      affiliateUserId: createAffiliationDto.affiliateUserId,
      affiliatedUserId: createAffiliationDto.affiliatedUserId,
      earningPercentage: createAffiliationDto.earningPercentage,
    });

    // Fetch the full affiliation with relations
    return this.userAffiliationRepository.findOne({
      where: { id: affiliation.id },
      relations: {
        affiliateUser: {
          userType: true,
        },
        affiliatedUser: {
          userType: true,
        },
      },
    });
  }
}
