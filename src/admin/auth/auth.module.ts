import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserAdminModule } from '../user-admin/user-admin.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAdminStrategy } from './auth.strategy';
import { TwoFactorModule } from './2fa.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => {
        const expiresIn = configService.get<string>('JWT_ADMIN_EXPIRES') ?? '1h';
        return {
          secret:
            configService.get<string>('JWT_ADMIN_SECRET') ?? 'GiftAssoAdmin!',
          signOptions: {
            expiresIn: expiresIn as any, // accessToken expiration.
          },
        };
      },
      inject: [ConfigService],
    }),
    UserAdminModule,
    TwoFactorModule,
  ],
  providers: [AuthService, JwtAdminStrategy, ConfigService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
