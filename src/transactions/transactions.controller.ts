import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Request,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { TransactionsService } from './transactions.service';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/auth/guards/admin.guard';
import { TransactionFilterDto } from './dto/transaction-filter.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('payout')
  @UseGuards(AdminGuard)
  createPayout(@Body() createPayoutDto: CreatePayoutDto) {
    return this.transactionsService.createPayout(createPayoutDto);
  }

  @Get()
  @UseGuards(AdminGuard)
  getTransactionHistory(
    @Query() filterDto: TransactionFilterDto,
  ) {
    return this.transactionsService.getTransactionHistory(filterDto);
  }

  @Get('association/history')
  @UseGuards(JwtAuthGuard)
  getAssociationTransactions(
    @Query() filterDto: TransactionFilterDto,
    @Request() request,
  ) {
    const associationId = request.user.id;
    return this.transactionsService.getAssociationTransactions(
      associationId,
      filterDto,
    );
  }

  @Get('association/overview')
  @UseGuards(JwtAuthGuard)
  getAssociationOverview(@Request() request) {
    const associationId = request.user.id;
    return this.transactionsService.getAssociationOverview(associationId);
  }

  @Get('association/export/csv')
  @UseGuards(JwtAuthGuard)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="transactions.csv"')
  async exportAssociationTransactionsCSV(
    @Request() request,
    @Res() response: Response,
  ) {
    const associationId = request.user.id;
    const csvData = await this.transactionsService.exportAssociationTransactionsToCSV(
      associationId,
    );

    const associationName = request.user.name_association || 'association';
    const filename = `${associationName.replace(/\s+/g, '_').toLowerCase()}_transactions.csv`;

    response.set({
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    response.send(csvData);
  }
}
