import { Module } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { WithdrawalController } from './withdrawal.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserWithdrawal } from '../../users/entities/user-withdrawal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserWithdrawal])],
  providers: [WithdrawalService],
  controllers: [WithdrawalController],
})
export class WithdrawalModule {}
