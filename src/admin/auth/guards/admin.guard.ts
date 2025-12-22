import { IS_ADMIN_KEY } from '../../../common/decorators/admin.decorator';
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '../../entities/admin.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isAdmin = this.reflector.getAllAndOverride<boolean>(IS_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isAdmin) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return [AdminRole.SUPER_ADMIN, AdminRole.AFFILIATE].includes(user?.role);
  }
}
