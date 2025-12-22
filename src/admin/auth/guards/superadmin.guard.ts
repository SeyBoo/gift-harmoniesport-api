import { IS_SUPER_ADMIN_KEY } from '../../../common/decorators/admin.decorator';
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '../../entities/admin.entity';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isSuperAdmin = this.reflector.getAllAndOverride<boolean>(
      IS_SUPER_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isSuperAdmin) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return user?.role === AdminRole.SUPER_ADMIN;
  }
}
