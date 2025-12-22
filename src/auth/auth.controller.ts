import {
  Body,
  Controller,
  Post,
  Headers,
  UnauthorizedException,
  UseGuards,
  Param,
  Get,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UserLoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from '../common/decorators';
import { AdminGuard } from '../admin/auth/guards';
import { GoogleAuthGuard } from './google-auth.guard';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  @Public()
  @UseGuards(JwtAuthGuard)
  @Post('login')
  async signIn(@Body() userLoginDto: UserLoginDto) {
    const user = await this.authService.validateUser(
      userLoginDto.email,
      userLoginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // return user;
    return this.authService.signIn(userLoginDto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() payload: { refreshToken: string }) {
    return this.authService.refreshToken(payload.refreshToken);
  }

  @UseGuards(AdminGuard)
  @Post('impersonate/:userId')
  async impersonate(@Param('userId') userId: string) {
    const user = await this.usersService.findOne(parseInt(userId));
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const token = await this.authService.signIn(user);
    return { token };
  }

  @UseGuards(JwtAuthGuard)
  @Post('updateProfile')
  async getProfile(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Token is missing');
    }

    const token = authHeader.split(' ')[1]; // Assuming 'Bearer TOKEN'
    // const token = this.usersService.updateToken(userLoginDto);
    if (!token) {
      throw new UnauthorizedException('Token is malformed');
    }

    // const updateToken = await this.authService.signIn(userLoginDto);
    const profile = this.authService.getProfile(token);
    return { profile };
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
   
  async googleAuth() {
    // This method is intentionally empty - 
    // it's handled by the GoogleAuthGuard
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const user = await this.authService.googleLogin(req.user);
    const redirectUrl =
      this.configService.get<string>('FRONT_URL') || 'http://localhost:3000';

    // Create a URL with tokens as query parameters
    const redirectUrlWithTokens = new URL(
      redirectUrl + '/auth/google-callback',
    );
    redirectUrlWithTokens.searchParams.append(
      'access_token',
      user.access_token,
    );
    redirectUrlWithTokens.searchParams.append(
      'refresh_token',
      user.refresh_token,
    );

    // Redirect to the frontend with tokens
    return res.redirect(redirectUrlWithTokens.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req) {
    const user = await this.usersService.findOne(req.user.id);

    return await this.authService.signInWithToken(user);
  }
}
