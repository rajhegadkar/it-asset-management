import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import { prisma } from '../config/db.js';

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return ApiResponse.error(res, 'Unauthenticated request', 401, 'UNAUTHORIZED');
    }

    // Super Admin has universal access
    if (req.user.roleName === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.roleName)) {
      return ApiResponse.error(
        res,
        `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`,
        403,
        'FORBIDDEN'
      );
    }

    next();
  };
}

export function requirePermission(permissionCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return ApiResponse.error(res, 'Unauthenticated request', 401, 'UNAUTHORIZED');
    }

    // Super Admin has universal access
    if (req.user.roleName === 'SUPER_ADMIN') {
      return next();
    }

    const hasPermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: req.user.roleId,
        permission: {
          code: permissionCode,
        },
      },
    });

    if (!hasPermission) {
      return ApiResponse.error(
        res,
        `Permission denied. Missing requirement: ${permissionCode}`,
        403,
        'PERMISSION_DENIED'
      );
    }

    next();
  };
}
