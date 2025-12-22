import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserLoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import * as jwt from 'jsonwebtoken';
import { AuthUser, GoogleUser } from './auth.interface';
import { User } from '../users/entities/user.entity';
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email);

    if (
      user &&
      (await this.usersService.comparePasswords(pass, user.password))
    ) {
      // Need to remove password from the response
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async refreshToken(refreshToken: string): Promise<AuthUser> {
    const decoded = this.jwtService.verify(refreshToken);
    const user = await this.usersService.findOne(decoded.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.signIn(user);
  }

  async signInWithToken(user: User): Promise<AuthUser> {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      lastname: user.lastname,
      address: user.address,
      description: user.description,
      reference: user.reference,
      rib: user.rib,
      name_association: user.name_association,
      activation_key: user.activation_key,
      user_status: user.user_status,
      logo: user.logo,
      site_internet: user.site_internet,
      thematic_id: user.thematic?.id,
      user_type_id: user.userType?.id,
      fond_usage_description: user.fond_usage_description,
    };
    return {
      access_token: await this.jwtService.signAsync(payload, {
        expiresIn: '12h',
      }),
      refresh_token: await this.jwtService.signAsync(payload, {
        expiresIn: '30d',
      }),
      user: {
        id: user.id,
        name: user.name,
        lastName: user.lastname,
        address: user.address,
        email: user.email,
        userType: user.userType,
        association: user.name_association
          ? {
              name_association: user.name_association,
              logo: user.logo,
              accountSetup: user.accountSetup,
              rib: user.rib,
              kycUrl: user.kycUrl,
              kybUrl: user.kybUrl,
              description: user.description,
              site_internet: user.site_internet,
              subThematic: user.subThematic,
              thematic: user.thematic,
              facebookLink: user.facebookLink,
              instagramLink: user.instagramLink,
              twitterLink: user.twitterLink,
              tiktokLink: user.tiktokLink,
              linkedinLink: user.linkedinLink,
              fond_usage_description: user.fond_usage_description,
            }
          : undefined,
      },
    };
  }

  async signIn(userLoginDto: UserLoginDto): Promise<AuthUser> {
    const user = await this.usersService.findOneByEmail(userLoginDto.email);
    if (
      !this.usersService.comparePasswords(user?.password, userLoginDto.password)
    ) {
      throw new UnauthorizedException();
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      lastname: user.lastname,
      address: user.address,
      description: user.description,
      reference: user.reference,
      rib: user.rib,
      name_association: user.name_association,
      activation_key: user.activation_key,
      user_status: user.user_status,
      logo: user.logo,
      site_internet: user.site_internet,
      thematic_id: user.thematic?.id,
      user_type_id: user.userType?.id,
      fond_usage_description: user.fond_usage_description,
    };
    return {
      access_token: await this.jwtService.signAsync(payload, {
        expiresIn: '12h',
      }),
      refresh_token: await this.jwtService.signAsync(payload, {
        expiresIn: '30d',
      }),
      user: {
        id: user.id,
        name: user.name,
        lastName: user.lastname,
        address: user.address,
        email: user.email,
        userType: user.userType,
        association: user.name_association
          ? {
              name_association: user.name_association,
              logo: user.logo,
              accountSetup: user.accountSetup,
              rib: user.rib,
              kycUrl: user.kycUrl,
              kybUrl: user.kybUrl,
              description: user.description,
              site_internet: user.site_internet,
              subThematic: user.subThematic,
              thematic: user.thematic,
              fond_usage_description: user.fond_usage_description,
            }
          : undefined,
      },
    };
  }

  decodeToken(token: string): any {
    try {
      const decoded = jwt.verify(
        token,
        'mysecret_metacard_checkSignature-Kr3@l!d',
      );
      return decoded;
    } catch (err) {
      throw new Error(`Invalid token: ${err.message}`);
    }
  }

  getProfile(token: string) {
    try {
      const decodedToken = this.jwtService.verify(token);
      return { ...decodedToken };
    } catch (err) {
      throw new UnauthorizedException(`Invalid token: ${err.message}`);
    }
  }
  // async login( userLoginDto: UserLoginDto) {
  //   const payload = { email: userLoginDto.email, sub: userLoginDto.password };
  //   return {
  //     access_token: this.jwtService.sign(payload),
  //   };
  // }

  async updateToken(
    userLoginDto: UserLoginDto,
  ): Promise<{ access_token: string }> {
    const user = await this.usersService.findOneByEmail(userLoginDto.email);
    if (
      !this.usersService.comparePasswords(user?.password, userLoginDto.password)
    ) {
      throw new UnauthorizedException();
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      lastname: user.lastname,
      address: user.address,
      description: user.description,
      reference: user.reference,
      rib: user.rib,
      name_association: user.name_association,
      activation_key: user.activation_key,
      user_status: user.user_status,
      logo: user.logo,
      site_internet: user.site_internet,
      thematic_id: user.thematic.id,
      user_type_id: user.userType.id,
    };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async validateGoogleUser(googleUser: GoogleUser): Promise<any> {
    let user = await this.usersService.findOneByEmail(googleUser.email);
    if (!user) {
      user = await this.usersService.createGoogleUser({
        email: googleUser.email,
        name: googleUser.firstName,
        lastname: googleUser.lastName,
        picture: googleUser.picture,
      });
    }
    // Return user without password
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  async googleLogin(user: any): Promise<AuthUser> {
    if (!user) {
      throw new UnauthorizedException('No user from Google');
    }
    return this.signInWithToken(user);
  }
}
