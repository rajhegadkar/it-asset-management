import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logAuditEvent } from '../middlewares/audit.js';

export class AuthService {
  /**
   * User Login with Account Lockout & Password Verification
   */
  static async login(params: {
    emailOrUsername: string;
    password: string;
    totpCode?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const identifier = params.emailOrUsername.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        employeeProfile: true,
        organization: true,
      },
    });

    if (!user) {
      throw { statusCode: 401, message: 'Invalid credentials provided', code: 'INVALID_CREDENTIALS' };
    }

    // Check account lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      throw {
        statusCode: 403,
        message: `Account is temporarily locked due to multiple failed logins. Please try again in ${waitMinutes} minutes.`,
        code: 'ACCOUNT_LOCKED',
      };
    }

    if (!user.isActive) {
      throw { statusCode: 403, message: 'Your account has been deactivated. Please contact your IT administrator.', code: 'ACCOUNT_INACTIVE' };
    }

    // Verify Password
    const passwordValid = await bcrypt.compare(params.password, user.passwordHash);
    if (!passwordValid) {
      const newAttempts = user.failedLoginAttempts + 1;
      const lockoutUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null; // 15 min lock

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockoutUntil,
        },
      });

      await prisma.loginHistory.create({
        data: {
          userId: user.id,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          status: 'FAILED',
          reason: 'Incorrect password',
        },
      });

      throw {
        statusCode: 401,
        message: `Invalid credentials. ${lockoutUntil ? 'Account locked for 15 minutes.' : `${5 - newAttempts} attempt(s) remaining.`}`,
        code: 'INVALID_CREDENTIALS',
      };
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!params.totpCode) {
        return {
          requires2FA: true,
          tempUserId: user.id,
          message: 'Two-Factor Authentication code required',
        };
      }

      const isTotpValid = authenticator.check(params.totpCode, user.twoFactorSecret || '');
      if (!isTotpValid) {
        throw { statusCode: 401, message: 'Invalid 2FA code entered', code: 'INVALID_2FA_CODE' };
      }
    }

    // Reset failed login counter and record success
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: params.ipAddress,
      },
    });

    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        status: 'SUCCESS',
      },
    });

    // Generate JWT Access & Refresh Tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      organizationId: user.organizationId,
    };

    const accessToken = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
    const refreshToken = jwt.sign({ userId: user.id }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any });

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: {
          id: user.role.id,
          name: user.role.name,
          displayName: user.role.displayName,
        },
        permissions,
        organization: user.organization,
        employeeProfile: user.employeeProfile,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  /**
   * Refresh Token
   */
  static async refreshToken(refreshToken: string) {
    try {
      const decoded: any = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { role: true },
      });

      if (!user || !user.isActive) {
        throw { statusCode: 401, message: 'User is invalid or deactivated', code: 'INVALID_TOKEN' };
      }

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        roleId: user.roleId,
        roleName: user.role.name,
        organizationId: user.organizationId,
      };

      const newAccessToken = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
      return { accessToken: newAccessToken };
    } catch (err) {
      throw { statusCode: 401, message: 'Invalid or expired refresh token', code: 'INVALID_REFRESH_TOKEN' };
    }
  }

  /**
   * Setup 2FA / Generate Secret
   */
  static async setup2FA(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found' };

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'Enterprise ITAM', secret);

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return { secret, otpAuthUrl };
  }

  /**
   * Verify and Enable 2FA
   */
  static async enable2FA(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) throw { statusCode: 400, message: '2FA setup was not initiated' };

    const isValid = authenticator.check(code, user.twoFactorSecret);
    if (!isValid) throw { statusCode: 400, message: 'Invalid verification code' };

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { message: '2FA has been successfully activated for this account' };
  }

  /**
   * Change Password
   */
  static async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found' };

    const matches = await bcrypt.compare(currentPass, user.passwordHash);
    if (!matches) throw { statusCode: 400, message: 'Current password does not match' };

    const newHash = await bcrypt.hash(newPass, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { message: 'Password updated successfully' };
  }
}
