import { IS_ADMIN_AFFILIATE_KEY } from '../../../common/decorators/admin.decorator';
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '../../entities/admin.entity';

@Injectable()
export class AdminAffiliateGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isAdminAffiliate = this.reflector.getAllAndOverride<boolean>(
      IS_ADMIN_AFFILIATE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isAdminAffiliate) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return user?.role === AdminRole.AFFILIATE;
  }
}
