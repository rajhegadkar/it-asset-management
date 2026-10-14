import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { prisma } from '../config/db.js';
import { z } from 'zod';

const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().optional(),
});

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = loginSchema.parse(req.body);
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const result = await AuthService.login({
        ...validated,
        ipAddress,
        userAgent,
      });

      return ApiResponse.success(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return ApiResponse.error(res, 'Refresh token is required', 400, 'BAD_REQUEST');
      }

      const result = await AuthService.refreshToken(refreshToken);
      return ApiResponse.success(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: {
          role: true,
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
      const result = await AuthService.setup2FA(req.user!.id);
      return ApiResponse.success(res, result, '2FA setup secret generated');
    } catch (error) {
      next(error);
    }
  }

  static async enable2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;
      if (!code) return ApiResponse.error(res, 'Verification code is required', 400);

      const result = await AuthService.enable2FA(req.user!.id, code);
      return ApiResponse.success(res, result, '2FA enabled');
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
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
