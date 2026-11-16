import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { maintenanceMode } from './featureGate.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  roleId: string;
  roleName: string;
  organizationId?: string | null;
  employeeId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const STAFF_ROLES = ['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'];
export const ADMIN_ROLES = ['SUPER_ADMIN', 'IT_ADMIN'];

export function isStaff(req: Request): boolean {
  return !!req.user && STAFF_ROLES.includes(req.user.roleName);
}

export function isAdmin(req: Request): boolean {
  return !!req.user && ADMIN_ROLES.includes(req.user.roleName);
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Tokens are accepted ONLY from the Authorization header. Query-string tokens leak into
    // server logs, proxy logs and browser history, so they are no longer supported.
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';

    if (!token) {
      return ApiResponse.error(res, 'Authentication required. No token provided.', 401, 'UNAUTHORIZED');
    }
    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return ApiResponse.error(res, 'Token has expired. Please refresh your session.', 401, 'TOKEN_EXPIRED');
      }
      return ApiResponse.error(res, 'Invalid authentication token.', 401, 'INVALID_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: true,
        employeeProfile: true,
      },
    });

    if (!user || !user.isActive) {
      return ApiResponse.error(res, 'User account is inactive or no longer exists.', 401, 'ACCOUNT_INACTIVE');
    }

    // Session revocation: password change, logout-everywhere and deactivation bump tokenVersion.
    if ((decoded.tv ?? 0) !== user.tokenVersion) {
      return ApiResponse.error(res, 'Session has been revoked. Please sign in again.', 401, 'TOKEN_REVOKED');
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      return ApiResponse.error(res, 'Account is temporarily locked.', 403, 'ACCOUNT_LOCKED');
    }

    // Accounts created with a default/temporary password must change it before using the app
    if (user.mustChangePassword && !req.originalUrl.startsWith('/api/v1/auth/')) {
      return ApiResponse.error(res, 'You must change your password before continuing.', 403, 'PASSWORD_CHANGE_REQUIRED');
    }

    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      roleName: user.role.name,
      organizationId: user.organizationId,
      employeeId: user.employeeProfile?.id || null,
    };

    // Maintenance mode blocks writes for everyone except SUPER_ADMIN
    return maintenanceMode(req, res, next);
  } catch (error) {
    return ApiResponse.error(res, 'Authentication internal error', 500, 'AUTH_ERROR');
  }
}
