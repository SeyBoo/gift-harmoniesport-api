import { UsersService } from './users.service';
import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  Param,
  Delete,
  Headers,
  UseGuards,
  Res,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  Put,
  UploadedFiles,
  Query,
} from '@nestjs/common';
import * as xlsx from 'node-xlsx';
import { WalletsService } from '../wallets/wallets.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePassUserDto } from './dto/update-pass-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import * as multer from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MailjetService } from '../common/mailjet/mailjet.service';
import { Response } from 'express';
import {
  UPLOAD_WITHDRAWAL_INVOICE_LIMIT,
  WithdrawalStatus,
} from './entities/user-withdrawal.entity';
import { Public, Pagination } from '../common/decorators';
import {
  Coordinates,
  CoordinatesDto,
} from '../common/decorators/coordinates.decorator';
import {
  PaginationDto,
  ChangeUserPasswordDto,
  WithdrawalDto,
} from '../common/dtos';
import { TranslatorService } from '../common/translator/translator.service';
import { UploadService } from '../common/upload/upload.service';
import { PaymentService } from '../payment/payment.service';
import { UserTypeEnum } from './entities/user-type.entity';
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
    private authService: AuthService,
    private readonly mailjetService: MailjetService,
    private readonly uploadService: UploadService,
    private readonly translatorService: TranslatorService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get('/types')
  async getUserTypes() {
    return await this.usersService.getUserTypes();
  }

  @Public()
  @Get('/check/slug')
  async checkSlug(@Query('slug') slug: string) {
    return { unique: !(await this.usersService.doesSlugExist(slug)) };
  }

  @Public()
  @Post('association')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        {
          name: 'kyc',
          maxCount: 1,
        },
        {
          name: 'kyb',
          maxCount: 1,
        },
        {
          name: 'logo',
          maxCount: 1,
        },
      ],
      { storage: multer.memoryStorage() },
    ),
  )
  async createAssociation(
    @Body() createUserDto: CreateUserDto,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
      kyc?: Express.Multer.File[];
      kyb?: Express.Multer.File[];
    },
  ) {
    const walletGenerated = this.walletsService.generateWalletSecure();

    const userExist = await this.usersService.findOneByEmail(
      createUserDto.email,
    );

    if (userExist) {
      throw new HttpException('User already exists.', HttpStatus.CONFLICT);
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    createUserDto.reference = `${timestamp}-${randomString}`;

    createUserDto.logo = files?.logo?.[0]
      ? await this.uploadService.uploadFile(files?.logo?.[0].buffer, {
          ContentType: files?.logo?.[0].mimetype,
          Key: `uploads/associations/logo-${Date.now()}${path.extname(files?.logo?.[0].originalname)}`,
        })
      : '';
    createUserDto.kycUrl = files.kyc?.[0]
      ? await this.uploadService.uploadFile(files.kyc?.[0].buffer, {
          ContentType: files.kyc?.[0].mimetype,
          Key: `uploads/associations/kyc-${Date.now()}${path.extname(files.kyc?.[0].originalname)}`,
        })
      : '';

    createUserDto.kybUrl = files.kyb?.[0]
      ? await this.uploadService.uploadFile(files.kyb?.[0].buffer, {
          ContentType: files.kyb?.[0].mimetype,
          Key: `uploads/associations/kyb-${Date.now()}${path.extname(files.kyb?.[0].originalname)}`,
        })
      : '';

    const { fond_usage_description, mission_description, shorten_description } =
      await this.usersService.generateAssociationDescription(
        createUserDto?.description,
      );

    const address = `${createUserDto.address}`;

    const { lat, lng } = await this.usersService.getLatLng(address);

    const user = await this.usersService.createAssociation({
      ...createUserDto,
      fond_usage_description,
      mission_description,
      shorten_description,
      multilingualDescription: createUserDto.description
        ? await this.translatorService.translateAll(createUserDto.description)
        : undefined,
      latitude: lat,
      longitude: lng,
    });
    this.walletsService.create({
      address: walletGenerated.address,
      private_key: walletGenerated.privateKey,
      secret_key: walletGenerated.secretKey,
      user: user.id,
    });

    const variables = {
      firstname: createUserDto.name,
      lastname: createUserDto.lastname,
      email: createUserDto.email,
    };

    if (createUserDto.affiliateUserCode) {
      const affiliateUserId = (
        await this.usersService.findAnUser({
          affiliationCode: createUserDto.affiliateUserCode,
        })
      )?.id;
      if (affiliateUserId) {
        await this.usersService.createUserAffiliation({
          affiliateUserId,
          affiliatedUserId: user.id,
        });
      }
    }

    await this.mailjetService.sendTransactionalEmail(
      createUserDto.email,
      this.mailjetService.TEMPLATE_ID_BY_SERVICE['REGISTER_USER_ASSOCIATION'],
      variables,
    );

    if (process.env.NODE_ENV.includes('prod') && createUserDto.userType as unknown as string === "1") {
      // Non-blocking admin notification - don't await, catch errors silently
      this.mailjetService.sendEmail(
        'contact@giftasso.com',
        `New Association Registration: ${createUserDto.name || createUserDto.email}`,
        `A new association has registered on GiftAsso.\n\nEmail: ${createUserDto.email}\n\nPlease review and validate the association in the admin panel.`,
        `<h2>New Association Registration</h2>
        <p><strong>Email:</strong> ${createUserDto.email}</p>
        <hr>
        <p>Please review and validate the association in the admin panel.</p>`,
      ).catch((err) => console.error('Admin notification email failed:', err));
    }
    const signInUser = await this.authService.signIn({
      email: createUserDto.email,
      password: createUserDto.password,
    });

    return { success: true, id: user?.id, authUser: signInUser };
  }

  @Put('association')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        {
          name: 'kyc',
          maxCount: 1,
        },
        {
          name: 'kyb',
          maxCount: 1,
        },
        {
          name: 'logo',
          maxCount: 1,
        },
      ],
      { storage: multer.memoryStorage() },
    ),
  )
  async updateAssociation(
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
      kyc?: Express.Multer.File[];
      kyb?: Express.Multer.File[];
    },
  ) {
    delete updateUserDto.kyc;
    delete updateUserDto.kyb;

    const user = await this.usersService.findOne(req.user.id);
    if (!user) {
      throw new HttpException('Association not found', HttpStatus.NOT_FOUND);
    }

    if (files?.logo?.[0]) {
      updateUserDto.logo = await this.uploadService.uploadFile(
        files.logo[0].buffer,
        {
          ContentType: files.logo[0].mimetype,
          Key: `uploads/associations/logo-${Date.now()}${path.extname(files.logo[0].originalname)}`,
        },
      );
    }

    if (files.kyc?.[0]) {
      updateUserDto.kycUrl = await this.uploadService.uploadFile(
        files.kyc[0].buffer,
        {
          ContentType: files.kyc[0].mimetype,
          Key: `uploads/associations/kyc-${Date.now()}${path.extname(files.kyc[0].originalname)}`,
        },
      );
    }

    if (files.kyb?.[0]) {
      updateUserDto.kybUrl = await this.uploadService.uploadFile(
        files.kyb[0].buffer,
        {
          ContentType: files.kyb[0].mimetype,
          Key: `uploads/associations/kyb-${Date.now()}${path.extname(files.kyb[0].originalname)}`,
        },
      );
    }

    if (updateUserDto.description) {
      const {
        fond_usage_description,
        mission_description,
        shorten_description,
      } = await this.usersService.generateAssociationDescription(
        updateUserDto.description,
      );

      if (!updateUserDto.fond_usage_description) {
        updateUserDto.fond_usage_description = fond_usage_description;
      }

      updateUserDto.mission_description = mission_description;
      updateUserDto.shorten_description = shorten_description;
      updateUserDto.multilingualDescription =
        await this.translatorService.translateAll(updateUserDto.description);
    }

    if (updateUserDto.fond_usage_description) {
      updateUserDto.fond_usage_description =
        await this.translatorService.translateAll(
          updateUserDto.fond_usage_description as unknown as string,
        );
    }

    if (updateUserDto.address) {
      const { lat, lng } = await this.usersService.getLatLng(
        updateUserDto.address,
      );
      updateUserDto.latitude = lat;
      updateUserDto.longitude = lng;
    }

    if (!user.name_association && updateUserDto.name_association) {
      // generate slug
      const slug = await this.usersService.generateUniqueSlug(updateUserDto);
      updateUserDto.slug = slug;
    }

    await this.usersService.update(req.user.id, updateUserDto);

    // Wait for the update to complete and get the latest user data
    const refreshedUser = await this.usersService.findOne(req.user.id);

    // Generate new auth tokens with updated user data
    const signInUser = await this.authService.signInWithToken(refreshedUser);

    return { success: true, authUser: signInUser };
  }

  @Public()
  @Post('donor')
  async createDonor(@Body() createDonorDto: CreateDonorDto) {
    const walletGenerated = this.walletsService.generateWalletSecure();

    const userExist = await this.usersService.findOneByEmail(
      createDonorDto.email,
    );

    if (userExist) {
      throw new HttpException('User already exists.', HttpStatus.CONFLICT);
    }
    const user = await this.usersService.createDonor(createDonorDto);

    this.walletsService.create({
      address: walletGenerated.address,
      private_key: walletGenerated.privateKey,
      secret_key: walletGenerated.secretKey,
      user: user.id,
    });

    const variables = {
      firstname: createDonorDto.name,
      lastname: createDonorDto.lastname,
      email: createDonorDto.email,
    };

    if (createDonorDto.affiliateUserCode) {
      const affiliateUserId = (
        await this.usersService.findAnUser({
          affiliationCode: createDonorDto.affiliateUserCode,
        })
      )?.id;
      if (affiliateUserId) {
        await this.usersService.createUserAffiliation({
          affiliateUserId,
          affiliatedUserId: user.id,
        });
      }
    }
    await this.mailjetService.sendTransactionalEmail(
      createDonorDto.email,
      this.mailjetService.TEMPLATE_ID_BY_SERVICE['REGISTER_USER_DONOR'],
      variables,
    );

    await this.paymentService.claimProduct({ userId: user.id });

    const signInUser = await this.authService.signIn({
      email: createDonorDto.email,
      password: createDonorDto.password,
    });

    return { success: true, id: user.id, authUser: signInUser };
  }

  @Public()
  @Post('donor-update')
  async updateDonor(
    @Headers('authorization') userHeader: string,
    @Body() updateDonorDto: UpdateDonorDto,
  ) {
    const token = userHeader.split(' ')[1];
    const profile = this.authService.getProfile(token);
    if (profile) {
      // Don't update with empty email
      if (updateDonorDto.email === '') {
        delete updateDonorDto.email;
      }

      const a = await this.usersService.updateDonor(
        +profile.sub,
        updateDonorDto,
      );
      const user = await this.usersService.findOne(a.id);
      return {
        id: a.id,
        authUser: await this.authService.signInWithToken(user),
      };
    }
  }
  @Public()
  @Get('fetch-donor')
  async fetchDonor(@Headers('authorization') userHeader: string) {
    const token = userHeader.split(' ')[1];
    const profile = this.authService.getProfile(token);
    if (profile) {
      const a = await this.usersService.fetchDonorData(+profile.sub);
      return a;
    }
  }

  @Get('/public/asso-name')
  async getAssosNames(@Query('ids') ids: string) {
    const idsArray = ids.split(',').map((id) => parseInt(id.trim()));
    const a = await this.usersService.findAssosNames(idsArray);
    return a;
  }

  @UseGuards(JwtAuthGuard)
  @Post('updateProfile')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: multer.memoryStorage(),
    }),
  )
  async updateProfile(
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user.id;
      if (file) {
        updateUserDto.logo = file
          ? await this.uploadService.uploadFile(file.buffer, {
              ContentType: file.mimetype,
              Key: `uploads/associations/${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`,
            })
          : '';
      }

      // Check if the email already exists and is not the current user
      const userExist = await this.usersService.findOneByEmail(
        updateUserDto.email,
      );
      if (userExist && userExist.id !== userId) {
        throw new HttpException(
          'Email is already used by another user.',
          HttpStatus.CONFLICT,
        );
      }

      // Update the user profile
      const updatedUser = await this.usersService.updateProfile(
        userId,
        updateUserDto,
      );

      // Create a new token
      // const payload = {
      //   sub: updatedUser.id,
      //   email: updatedUser.email,
      //   name: updatedUser.name,
      //   lastname: updatedUser.lastname,
      //   address: updatedUser.address,
      //   description: updatedUser.description,
      //   reference: updatedUser.reference,
      //   rib: updatedUser.rib,
      //   name_association: updatedUser.name_association,
      //   activation_key: updatedUser.activation_key,
      //   user_status: updatedUser.user_status,
      //   logo: updatedUser.logo,
      //   site_internet: updatedUser.site_internet,
      //   thematic_id: updatedUser.thematic.id,
      //   user_type_id: updatedUser.userType.id
      // };
      const newToken = await this.usersService.updateToken(updateUserDto);
      // Send response
      res.set('Content-Type', 'application/json; charset=utf-8');
      return res.json({
        message: 'Profile updated successfully control',
        token: newToken,
        user: updatedUser,
      });
    } catch (error) {
      throw new HttpException(
        `Failed to update profile error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // @Public()
  // @UseGuards(JwtAuthGuard)
  // @Get('profile')
  // getProfile(@Headers('authorization') userHeader: string) {
  //   if (!userHeader) {
  //     throw new UnauthorizedException('Token is missing');
  //   }

  //   const token = userHeader.split(' ')[1]; // Assuming 'Bearer TOKEN'
  //   const profile = this.usersService.getProfile(token);
  //   return { profile };
  // }

  @Public()
  @Get('messages')
  async findMessageAsso(@Headers('authorization') userHeader: string) {
    const token = userHeader.split(' ')[1];
    const profile = this.authService.getProfile(token);
    if (profile) {
      const a = await this.usersService.findMessageAsso(+profile.sub);
      return a;
    }
  }

  @Public()
  @Get('fiscaux')
  async findFiscAsso(@Headers('authorization') userHeader: string) {
    const token = userHeader.split(' ')[1];
    const profile = this.authService.getProfile(token);
    if (profile) {
      const a = await this.usersService.findFiscAsso(+profile.sub);
      return a;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put('revenue-download')
  async downloadFiscalAsso(@Request() req, @Res() res: Response) {
    const userId = req.user?.id;

    if (userId) {
      const data = await this.usersService.findFiscAsso(userId);

      const formatedData = data.map((item) => [
        item.udon_name,
        item.udon_lastname,
        item.o_invoice_address +
          ', ' +
          item.o_invoice_postalcode +
          ' ' +
          item.o_invoice_city +
          ' ' +
          item.o_invoice_country,
        item.o_price / 100,
      ]);

      const sheetData = [
        ['Prénom', 'Nom', 'Address', 'Total'],
        ...formatedData,
      ];

      const excelBuffer = xlsx.build([
        { name: 'FiscalData', data: sheetData, options: {} },
      ]);

      res.setHeader(
        'Content-Disposition',
        'attachment; filename="FiscalData.xlsx"',
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      res.send(excelBuffer);
    }
  }

  @Public()
  @Get('fiscaux-donation')
  async findFiscDonation(@Headers('authorization') userHeader: string) {
    const token = userHeader.split(' ')[1];
    const profile = this.authService.getProfile(token);
    if (profile) {
      const a = await this.usersService.findFiscDonation(+profile.sub);
      return a;
    }
  }

  @Public()
  @Post('add-receipt')
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: multer.memoryStorage(),
    }),
  )
  async addReceipt(
    @Headers('authorization') userHeader: string,
    @Body('reference') reference: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const token = userHeader.split(' ')[1];
    const profile = this.authService.getProfile(token);
    const receiptName = file
      ? await this.uploadService.uploadFile(file.buffer, {
          ContentType: file.mimetype,
          Key: `uploads/receipts/${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`,
        })
      : '';
    if (profile) {
      const a = await this.usersService.addReceipt(
        +profile.sub,
        reference,
        receiptName,
      );
      return a;
    }
  }

  @Public()
  @Post('refuse-receipt')
  async refuseReceipt(
    @Headers('authorization') userHeader: string,
    @Body('reference') reference: string,
  ) {
    const token = userHeader.split(' ')[1];
    const profile = this.authService.getProfile(token);
    if (profile) {
      const a = await this.usersService.refuseReceipt(+profile.sub, reference);
      return a;
    }
  }

  @Public()
  @Get('dashboard-resume')
  async getDashboardResume(@Headers('authorization') userHeader: string) {
    const token = userHeader.split(' ')[1];
    const profile = this.authService.getProfile(token);
    if (profile) {
      const a = await this.usersService.dashboardResume(+profile.sub);
      return a;
    }
  }

  @Public()
  @Get('associations')
  async getAsso(
    @Pagination() pagination: PaginationDto,
    @Coordinates() coordinates: CoordinatesDto,
    @Query('subThematicIds') subThematicIds?: string,
  ) {
    const { lat, lng } = coordinates;

    const [datas, count] =
      await this.usersService.getUsersWithCampaignAndProduct(
        pagination,
        {
          latitude: lat,
          longitude: lng,
        },
        subThematicIds ? subThematicIds.split(',') : undefined,
      );
    return {
      page: count / pagination.limit,
      datas: datas.map((e) => ({ ...e, thematic_id: e.thematic?.id })),
    };
  }

  @Public()
  @Get('labels')
  async getLabels(@Pagination() pagination: PaginationDto) {
    const [datas, count] = await this.usersService.getLabels({}, pagination);
    return { count, datas };
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body('email') email: string) {
    const user = await this.usersService.findOneByEmailSimple(email);
    if (user) {
      const to = email;
      const passtoken =
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2);
      const variables = {
        firstname: user.name || '',
        lastname: user.lastname || '',
        url: `${process.env.FRONT_URL}/reset?resetpass=${passtoken}`,
      };
      user.token_pass = passtoken;
      user.token_pass_date_start = new Date();
      await this.usersService.update(user.id, user);
      return await this.mailjetService.sendTransactionalEmail(
        to,
        this.mailjetService.TEMPLATE_ID_BY_SERVICE['FORGET_PASSWORD'],
        variables,
      );
    } else {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
  }

  @Public()
  @Post('send-message')
  async sendMessage(
    @Body('email') email: string,
    @Body('message') message: string,
  ) {
    if (email && message) {
      const to = 'contact@giftasso.com';
      const templateId = 6176476;
      const variables = {
        email: email,
        message: message,
      };
      return await this.mailjetService.sendTransactionalEmail(
        to,
        templateId,
        variables,
      );
    } else {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
  }

  @Public()
  @Post('change-password')
  async changePassword(
    @Body('token') token: string,
    @Body('pass') pass: string,
  ) {
    const user = await this.usersService.findOneByTokenPass(token);
    if (user) {
      const currentTime = new Date().getTime();
      const tokenStartTime = new Date(user.token_pass_date_start).getTime();
      const tokenExpirationTime = tokenStartTime + 1 * 60 * 60 * 1000;
      if (currentTime < tokenExpirationTime) {
        const passwordHashed = await this.usersService.hashPassword(pass);
        const updateUserDto: UpdatePassUserDto = {
          password: passwordHashed,
          token_pass: null,
          token_pass_date_start: null,
        };

        await this.usersService.update(user.id, updateUserDto);
        return { message: 'Password successfully changed.' };
      } else {
        throw new HttpException('Token has expired.', HttpStatus.NOT_FOUND);
      }
    }
    throw new HttpException('Invalid token.', HttpStatus.NOT_FOUND);
  }

  @UseGuards(JwtAuthGuard)
  @Put('password')
  async updatePassword(@Request() req, @Body() body: ChangeUserPasswordDto) {
    const user = await this.usersService.findOne(req.user.id);
    if (user) {
      const passwordHashed = await this.usersService.hashPassword(
        body.password,
      );
      const updateUserDto: UpdatePassUserDto = {
        password: passwordHashed,
        token_pass: null,
        token_pass_date_start: null,
      };

      await this.usersService.update(user.id, updateUserDto);
      return { message: 'Password successfully changed.' };
    } else {
      throw new HttpException('User not found.', HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('affiliation')
  async getAffiliation(@Request() req) {
    return await this.usersService.getUserAffiliationStats(req?.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('affiliation/affiliated')
  async getAffiliatedFromAffiliation(@Request() req) {
    const datasByAssociation =
      await this.usersService.getAffiliationDataByAssociation(req.user.id);
    return {
      datasByAssociation,
      datasByDonor: await this.usersService.getAffiliationDataByDonor(
        req.user.id,
      ),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('withdrawal')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: UPLOAD_WITHDRAWAL_INVOICE_LIMIT },
    }),
  )
  async claimWithdrawal(
    @Request() req,
    @Body() body: WithdrawalDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new HttpException('Missing invoice', 404);
    }
    const amount = Number(body.amount ?? 0);
    const userBalance = await this.usersService.getUserBalance(req.user.id);
    if (userBalance < amount) {
      throw new ForbiddenException('Insufficient balance');
    }

    const lastWithdrawal = await this.usersService.getOneWithdrawal({
      status: WithdrawalStatus.PENDING,
      userId: req.user.id,
    });
    if (lastWithdrawal) {
      throw new ForbiddenException('You have already one pending withdrawal');
    }

    const invoiceUrl = await this.uploadService.uploadFile(file.buffer, {
      Key: `invoices/${req.user.id}/${uuidv4()}.pdf`,
      ContentType: file.mimetype,
    });

    if (body.rib) {
      await this.usersService.update(req.user.id, { rib: body.rib });
    }

    const data = await this.usersService.createWithdrawal({
      status: WithdrawalStatus.PENDING,
      invoiceUrl,
      amount,
      userId: req.user.id,
    });

    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('withdrawal')
  async getWithdrawal(@Request() req, @Pagination() pagination: PaginationDto) {
    const [datas, count] = await this.usersService.getWithdrawal(
      { userId: req.user.id },
      pagination,
    );
    return { datas, count };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Public()
  @Get('custombyasso/:id')
  findOneCustomByAsso(@Param('id') id: string) {
    return this.usersService.findOneCustomByAsso(id);
  }

  @Public()
  @Get('custombycard/:id')
  async findOneCustomByCard(@Param('id') id: string) {
    return await this.usersService.findOneCustomByCard(id);
  }

  @Get(':email')
  findOneByEmail(@Param('email') email: string) {
    return this.usersService.findOne(+email);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
  //   return this.usersService.updateUser(id, updateUserDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
