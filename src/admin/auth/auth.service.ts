import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserAdminService } from '../user-admin/user-admin.service';
import { Admin } from '../entities/admin.entity';
import { AdminLoginDto } from '../../common/dtos';

@Injectable()
export class AuthService {
  constructor(
    private readonly userAdminService: UserAdminService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: AdminLoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.isTwoFactorEnabled) {
      return {
        requiresTwoFactor: true,
        userId: user.id,
      };
    }

    return this.generateTokens(user);
  }

  async validateUser(email: string, password: string): Promise<Admin | null> {
    const user = await this.userAdminService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async verifyTwoFactor(userId: string, code: string) {
    const user = await this.userAdminService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCodeValid = user.verifyAuthenticatorCode(code);
    if (!isCodeValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    return this.generateTokens(user);
  }

  private generateTokens(user: Admin) {
    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accessLevel: user.accessLevel,
    };

    const refreshPayload = {
      sub: user.id,
      type: 'refresh',
    };

    return {
      accessToken: this.jwtService.sign(accessPayload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(refreshPayload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        accessLevel: user.accessLevel,
        profileImage: user.profileImage,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.userAdminService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Admin not found');
      }
      const tokens = this.generateTokens(user);
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException(`Invalid refresh token: ${error.message}`);
    }
  }
}
