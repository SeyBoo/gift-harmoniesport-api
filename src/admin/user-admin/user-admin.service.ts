import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Admin } from '../entities/admin.entity';
import { PaginatedResponse } from '../../common/interfaces';
import { CreateAdminDto, ListAdminsDto } from '../../common/dtos';

@Injectable()
export class UserAdminService {
  constructor(
    @InjectRepository(Admin)
    private readonly userRepository: Repository<Admin>,
  ) {}

  async findById(id: string): Promise<Admin | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<Admin | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async setTwoFactorSecret(userId: string, secret: string): Promise<void> {
    await this.userRepository.update(userId, {
      twoFactorSecret: secret,
    });
  }

  async update(id: string, data: Partial<Admin>): Promise<Admin> {
    await this.userRepository.update(id, data);
    return this.findById(id);
  }

  async createAdmin(createAdminDto: CreateAdminDto): Promise<Admin> {
    const admin = this.userRepository.create({
      ...createAdminDto,
      isTwoFactorEnabled: createAdminDto.requireTwoFactor || false,
    });
    return this.userRepository.save(admin);
  }

  async listAdmins(dto: ListAdminsDto): Promise<PaginatedResponse<Admin>> {
    const { page = 1, limit = 10, search, role, isTwoFactorEnabled } = dto;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (isTwoFactorEnabled !== undefined) {
      where.isTwoFactorEnabled = isTwoFactorEnabled === 'true';
    }

    if (search) {
      where.email = ILike(`%${search}%`);
    }

    const [items, total] = await this.userRepository.findAndCount({
      where,
      select: [
        'id',
        'email',
        'role',
        'accessLevel',
        'isTwoFactorEnabled',
        'createdAt',
      ],
      skip,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
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
}
