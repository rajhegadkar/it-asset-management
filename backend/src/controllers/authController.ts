import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { prisma } from '../config/db.js';
import { z } from 'zod';

const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required').max(200),
  password: z.string().min(1, 'Password is required').max(200),
  totpCode: z.string().max(20).optional(),
});

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await AuthService.login({
        ...validated,
        ipAddress: clientIp(req),
        userAgent: req.headers['user-agent'] || 'Unknown',
      });
      return ApiResponse.success(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body || {};
      if (!refreshToken || typeof refreshToken !== 'string') {
        return ApiResponse.error(res, 'Refresh token is required', 400, 'BAD_REQUEST');
      }
      const result = await AuthService.refreshToken(refreshToken);
      return ApiResponse.success(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.logoutEverywhere(req.user!.id);
      return ApiResponse.success(res, result, 'Logged out');
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatarUrl: true,
          isActive: true,
          twoFactorEnabled: true,
          mustChangePassword: true,
          lastLoginAt: true,
          role: { select: { id: true, name: true, displayName: true } },
          organization: true,
          employeeProfile: true,
        },
      });
      return ApiResponse.success(res, user, 'Current session profile');
    } catch (error) {
      next(error);
    }
  }

  static async setup2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.setup2FA(req.user!.id, {
        currentPassword: req.body?.currentPassword,
        code: req.body?.code,
      });
      return ApiResponse.success(res, result, '2FA setup secret generated');
    } catch (error) {
      next(error);
    }
  }

  static async enable2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.body || {};
      if (!code) return ApiResponse.error(res, 'Verification code is required', 400);
      const result = await AuthService.enable2FA(req.user!.id, String(code));
      return ApiResponse.success(res, result, '2FA enabled');
    } catch (error) {
      next(error);
    }
  }

  static async disable2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, code } = req.body || {};
      const result = await AuthService.disable2FA(req.user!.id, currentPassword, code);
      return ApiResponse.success(res, result, '2FA disabled');
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return ApiResponse.error(res, 'Both current and new passwords are required', 400);
      }
      const result = await AuthService.changePassword(req.user!.id, currentPassword, newPassword);
      return ApiResponse.success(res, result, 'Password updated');
    } catch (error) {
      next(error);
    }
  }
}
