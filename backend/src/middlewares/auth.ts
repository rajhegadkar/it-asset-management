import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { ApiResponse } from '../utils/apiResponse.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
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

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 'Authentication required. No token provided.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return ApiResponse.error(res, 'Token has expired. Please refresh your session.', 401, 'TOKEN_EXPIRED');
      }
      return ApiResponse.error(res, 'Invalid authentication token.', 401, 'INVALID_TOKEN');
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: true,
        employeeProfile: true,
      },
    });

    if (!user || !user.isActive) {
      return ApiResponse.error(res, 'User account is inactive or no longer exists.', 403, 'ACCOUNT_INACTIVE');
    }

    // Check account lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      return ApiResponse.error(
        res,
        `Account is temporarily locked until ${user.lockoutUntil.toLocaleTimeString()}`,
        403,
        'ACCOUNT_LOCKED'
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      roleId: user.roleId,
      roleName: user.role.name,
      organizationId: user.organizationId,
      employeeId: user.employeeProfile?.id || null,
    };

    next();
  } catch (error) {
    return ApiResponse.error(res, 'Authentication internal error', 500, 'AUTH_ERROR');
  }
}
