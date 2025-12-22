import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { TwoFactorService } from './2fa.service';
import {
  AdminLoginDto,
  AdminRefreshTokenDto,
  Enable2FADto,
  TwoFactorDto,
} from '../../common/dtos';
import { Public } from '../../common/decorators';
import { JwtAuthGuardAdmin } from './guards';
import { Admin } from '../entities/admin.entity';
import { CurrentUser } from '../../common/decorators/admin.decorator';

@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() loginDto: AdminLoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: AdminRefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Public()
  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  async verifyTwoFactor(@Body() twoFactorDto: TwoFactorDto) {
    const { userId, code } = twoFactorDto;
    return this.authService.verifyTwoFactor(userId, code);
  }

  @UseGuards(JwtAuthGuardAdmin)
  @Post('2fa/generate')
  async generateTwoFactor(@CurrentUser() user: Admin) {
    if (user.isTwoFactorEnabled) {
      throw new UnauthorizedException('2FA is already enabled');
    }
    return this.twoFactorService.generateSecret(user);
  }

  @UseGuards(JwtAuthGuardAdmin)
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  async enableTwoFactor(
    @CurrentUser() user: Admin,
    @Body() enable2FADto: Enable2FADto,
  ) {
    const isEnabled = await this.twoFactorService.enableTwoFactor(
      user.id,
      enable2FADto.code,
    );

    if (!isEnabled) {
      throw new UnauthorizedException('Invalid verification code');
    }

    return { message: '2FA has been enabled successfully' };
  }

  @UseGuards(JwtAuthGuardAdmin)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  async disableTwoFactor(@CurrentUser() user: Admin) {
    const isDisabled = await this.twoFactorService.disableTwoFactor(user.id);

    if (!isDisabled) {
      throw new UnauthorizedException('Failed to disable 2FA');
    }

    return { message: '2FA has been disabled successfully' };
  }

  @UseGuards(JwtAuthGuardAdmin)
  @Get('me')
  async getCurrentUser(@CurrentUser() user: Admin) {
    return { user };
  }
}
