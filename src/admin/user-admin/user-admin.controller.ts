import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { TwoFactorService } from '../auth/2fa.service';
import { UserAdminService } from './user-admin.service';
import { CreateAdminDto, ListAdminsDto } from '../../common/dtos';
import { JwtAuthGuardAdmin, RolesGuard } from '../auth/guards';
import { AdminRole } from '../entities/admin.entity';
import { Roles } from '../../common/decorators/admin.decorator';

@Controller('admin/user-admin')
@UseGuards(JwtAuthGuardAdmin, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN)
export class UserAdminController {
  constructor(
    private readonly userAdminService: UserAdminService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Post()
  async createAdmin(@Body() createAdminDto: CreateAdminDto) {
    const admin = await this.userAdminService.createAdmin(createAdminDto);

    let twoFactorData = null;

    if (createAdminDto.requireTwoFactor) {
      twoFactorData = await this.twoFactorService.generateSecret(admin);
    }
    return {
      message: 'Admin created successfully',
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        accessLevel: admin.accessLevel,
      },
      twoFactor: twoFactorData
        ? {
            secret: twoFactorData.secret,
            qrCodeUrl: twoFactorData.otpauthUrl,
            qrCode: twoFactorData.qrCodeDataUrl,
          }
        : null,
    };
  }

  @Get()
  async getAdmins(@Query() dto: ListAdminsDto) {
    return await this.userAdminService.listAdmins(dto);
  }
}
