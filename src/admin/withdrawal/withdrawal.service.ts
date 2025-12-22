import { ListWithdrawalsDto, ProcessWithdrawalDto } from '../../common/dtos';
import {
  UserWithdrawal,
  WithdrawalStatus,
} from '../../users/entities/user-withdrawal.entity';
import { PaginatedResponse } from '../../common/interfaces';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

@Injectable()
export class WithdrawalService {
  constructor(
    @InjectRepository(UserWithdrawal)
    private withdrawalRepository: Repository<UserWithdrawal>,
  ) {}

  async listWithdrawals(
    dto: ListWithdrawalsDto,
  ): Promise<PaginatedResponse<UserWithdrawal>> {
    const where: FindOptionsWhere<UserWithdrawal> = {};

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.userId) {
      where.userId = dto.userId;
    }

    if (dto.search) {
      where.user = {
        email: ILike(`%${dto.search}%`),
      };
    }

    const [items, total] = await this.withdrawalRepository.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
    });

    return {
      items,
      meta: {
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }
  async processWithdrawal(
    id: number,
    dto: ProcessWithdrawalDto,
  ): Promise<UserWithdrawal> {
    const withdrawal = await this.withdrawalRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(
        'This withdrawal has already been processed',
      );
    }

    withdrawal.status = dto.status;

    if (dto.status === WithdrawalStatus.REJECTED) {
      if (!dto.rejectReason) {
        throw new BadRequestException('Rejection reason is required');
      }
      withdrawal.rejectReason = dto.rejectReason;
    } else {
      withdrawal.rejectReason = null;
    }

    if (dto.status === WithdrawalStatus.ACCEPTED) {
      if (!dto.receiptId) {
        throw new BadRequestException('Receipt id is required');
      }
      withdrawal.receiptId = dto.receiptId;
    } else {
      withdrawal.receiptId = null;
    }

    return this.withdrawalRepository.save(withdrawal);
  }
}
