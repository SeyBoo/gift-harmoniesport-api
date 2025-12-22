import { Module } from '@nestjs/common';
import { UserAffiliationsController } from './user-affiliations.controller';
import { UserAffiliationsService } from './user-affiliations.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAffiliation } from '../../users/entities/user-affiliation.entity';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserAffiliation]), UsersModule],
  controllers: [UserAffiliationsController],
  providers: [UserAffiliationsService],
})
export class UserAffiliationsModule {}
