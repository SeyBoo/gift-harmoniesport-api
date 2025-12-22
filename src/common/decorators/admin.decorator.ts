import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../../admin/entities/admin.entity';

export const IS_ADMIN_KEY = 'isAdmin';
export const IsAdmin = () => SetMetadata(IS_ADMIN_KEY, true);

export const IS_ADMIN_AFFILIATE_KEY = 'isAdminAffiliate';
export const IsAdminAffiliate = () => SetMetadata(IS_ADMIN_AFFILIATE_KEY, true);

export const IS_SUPER_ADMIN_KEY = 'isSuperAdmin';
export const IsSuperAdmin = () => SetMetadata(IS_SUPER_ADMIN_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
