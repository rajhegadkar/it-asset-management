import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logAuditEvent } from '../middlewares/audit.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
// Used to make "unknown user" take as long as "wrong password" (no user enumeration by timing)
const DUMMY_HASH = bcrypt.hashSync('itam-dummy-password-for-timing', 10);
const GENERIC_LOGIN_ERROR = { statusCode: 401, message: 'Invalid credentials provided', code: 'INVALID_CREDENTIALS' };

export function validatePasswordPolicy(password: string): void {
  const problems: string[] = [];
  if (!password || password.length < 10) problems.push('at least 10 characters');
  if (!/[a-z]/.test(password || '')) problems.push('a lowercase letter');
  if (!/[A-Z]/.test(password || '')) problems.push('an uppercase letter');
  if (!/[0-9]/.test(password || '')) problems.push('a number');
  if (problems.length) {
    throw { statusCode: 400, message: `Password must contain ${problems.join(', ')}.`, code: 'WEAK_PASSWORD' };
  }
}

type TokenUser = { id: string; email: string; roleId: string; organizationId: string | null; tokenVersion: number; role: { name: string } };

function issueTokens(user: TokenUser) {
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
    organizationId: user.organizationId,
    tv: user.tokenVersion,
  };
  const accessToken = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
  const refreshToken = jwt.sign(
    { userId: user.id, tv: user.tokenVersion, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );
  return { accessToken, refreshToken };
}

function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

async function registerFailedAttempt(user: { id: string; failedLoginAttempts: number }, reason: string, params: { ipAddress?: string; userAgent?: string }) {
  const newAttempts = user.failedLoginAttempts + 1;
  const lockoutUntil = newAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: lockoutUntil ? 0 : newAttempts, lockoutUntil },
  });
  await prisma.loginHistory.create({
    data: { userId: user.id, ipAddress: params.ipAddress, userAgent: params.userAgent, status: 'FAILED', reason },
  });
  void logAuditEvent({ userId: user.id, action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, newValues: { reason, ip: params.ipAddress } });
}

export class AuthService {
  /**
   * User Login with Account Lockout, 2FA (TOTP or recovery code) & Password Verification
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
      where: { OR: [{ email: identifier }, { username: identifier }] },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        employeeProfile: true,
        organization: true,
      },
    });

    if (!user) {
      await bcrypt.compare(params.password, DUMMY_HASH);
      throw GENERIC_LOGIN_ERROR;
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw {
        statusCode: 429,
        message: 'Too many failed sign-in attempts. Please try again later.',
        code: 'ACCOUNT_LOCKED',
      };
    }

    const passwordValid = await bcrypt.compare(params.password, user.passwordHash);
    if (!passwordValid) {
      await registerFailedAttempt(user, 'Incorrect password', params);
      throw GENERIC_LOGIN_ERROR;
    }

    // Only reveal account state to someone who already knows the password
    if (!user.isActive) {
      throw { statusCode: 403, message: 'Your account has been deactivated. Please contact your IT administrator.', code: 'ACCOUNT_INACTIVE' };
    }

    // 2FA: TOTP code, or a single-use recovery code (format XXXXX-XXXXX)
    if (user.twoFactorEnabled) {
      if (!params.totpCode) {
        return { requires2FA: true, message: 'Two-Factor Authentication code required' };
      }
      const code = params.totpCode.trim().toUpperCase();
      let ok = /^\d{6}$/.test(code) && authenticator.check(code, user.twoFactorSecret || '');
      let usedRecovery = false;
      if (!ok && /^[0-9A-F]{5}-[0-9A-F]{5}$/.test(code) && user.twoFactorRecoveryCodes) {
        const hashes: string[] = JSON.parse(user.twoFactorRecoveryCodes);
        for (let i = 0; i < hashes.length; i++) {
          if (await bcrypt.compare(code, hashes[i])) {
            hashes.splice(i, 1);
            await prisma.user.update({ where: { id: user.id }, data: { twoFactorRecoveryCodes: JSON.stringify(hashes) } });
            ok = true;
            usedRecovery = true;
            break;
          }
        }
      }
      if (!ok) {
        await registerFailedAttempt(user, 'Invalid 2FA code', params);
        throw { statusCode: 401, message: 'Invalid 2FA code entered', code: 'INVALID_2FA_CODE' };
      }
      if (usedRecovery) {
        void logAuditEvent({ userId: user.id, username: user.username, action: 'SECURITY', entity: 'User', entityId: user.id, newValues: { event: '2FA recovery code used' } });
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockoutUntil: null, lastLoginAt: new Date(), lastLoginIp: params.ipAddress },
    });
    await prisma.loginHistory.create({
      data: { userId: user.id, ipAddress: params.ipAddress, userAgent: params.userAgent, status: 'SUCCESS' },
    });
    void logAuditEvent({ userId: user.id, username: user.username, organizationId: user.organizationId, action: 'LOGIN', entity: 'User', entityId: user.id, newValues: { ip: params.ipAddress } });

    const { accessToken, refreshToken } = issueTokens(user);
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
        role: { id: user.role.id, name: user.role.name, displayName: user.role.displayName },
        permissions,
        organization: user.organization,
        employeeProfile: user.employeeProfile,
        twoFactorEnabled: user.twoFactorEnabled,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Refresh Token — rotates: every refresh returns a new refresh token as well.
   * Tokens issued before a password change / logout (tokenVersion bump) are rejected.
   */
  static async refreshToken(refreshToken: string) {
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw { statusCode: 401, message: 'Invalid or expired refresh token', code: 'INVALID_REFRESH_TOKEN' };
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, include: { role: true } });
    if (!user || !user.isActive || (decoded.tv ?? 0) !== user.tokenVersion) {
      throw { statusCode: 401, message: 'Session is no longer valid. Please sign in again.', code: 'INVALID_REFRESH_TOKEN' };
    }
    return issueTokens(user);
  }

  /** Signs the user out on every device by invalidating all issued tokens. */
  static async logoutEverywhere(userId: string) {
    await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    return { message: 'Signed out on all devices' };
  }

  /**
   * Setup 2FA / Generate Secret.
   * If 2FA is already on, re-keying requires the current password AND a valid current code,
   * so a stolen session token cannot silently take over the second factor.
   */
  static async setup2FA(userId: string, params: { currentPassword?: string; code?: string } = {}) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found' };

    if (!params.currentPassword || !(await bcrypt.compare(params.currentPassword, user.passwordHash))) {
      throw { statusCode: 400, message: 'Current password is required to set up two-factor authentication', code: 'PASSWORD_REQUIRED' };
    }
    if (user.twoFactorEnabled) {
      if (!params.code || !authenticator.check(params.code, user.twoFactorSecret || '')) {
        throw { statusCode: 400, message: 'Enter a valid code from your current authenticator to re-configure 2FA', code: 'INVALID_2FA_CODE' };
      }
    }

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'Enterprise ITAM', secret);

    // Pending secret: 2FA stays OFF until enable2FA() verifies a code from the new secret
    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });

    return { secret, otpAuthUrl };
  }

  /**
   * Verify and Enable 2FA. Returns 8 single-use recovery codes (shown once, stored hashed).
   */
  static async enable2FA(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) throw { statusCode: 400, message: '2FA setup was not initiated' };

    if (!authenticator.check(code, user.twoFactorSecret)) throw { statusCode: 400, message: 'Invalid verification code' };

    const recoveryCodes = generateRecoveryCodes();
    const hashes = await Promise.all(recoveryCodes.map((c) => bcrypt.hash(c, 10)));

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorRecoveryCodes: JSON.stringify(hashes) },
    });
    void logAuditEvent({ userId, action: 'SECURITY', entity: 'User', entityId: userId, newValues: { event: '2FA enabled' } });

    return { message: '2FA has been successfully activated for this account', recoveryCodes };
  }

  /** Disable 2FA — requires current password and a valid TOTP or recovery code. */
  static async disable2FA(userId: string, currentPassword: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found' };
    if (!(await bcrypt.compare(currentPassword || '', user.passwordHash))) {
      throw { statusCode: 400, message: 'Current password does not match' };
    }
    if (user.twoFactorEnabled && !authenticator.check(code || '', user.twoFactorSecret || '')) {
      throw { statusCode: 400, message: 'Invalid verification code' };
    }
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: null, tokenVersion: { increment: 1 } },
    });
    void logAuditEvent({ userId, action: 'SECURITY', entity: 'User', entityId: userId, newValues: { event: '2FA disabled' } });
    return { message: 'Two-factor authentication disabled. Please sign in again.' };
  }

  /**
   * Change Password — enforces the password policy and revokes every existing session.
   * Returns fresh tokens so the current browser stays signed in.
   */
  static async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw { statusCode: 404, message: 'User not found' };

    const matches = await bcrypt.compare(currentPass, user.passwordHash);
    if (!matches) throw { statusCode: 400, message: 'Current password does not match' };

    validatePasswordPolicy(newPass);
    if (await bcrypt.compare(newPass, user.passwordHash)) {
      throw { statusCode: 400, message: 'New password must be different from the current password', code: 'WEAK_PASSWORD' };
    }

    const newHash = await bcrypt.hash(newPass, 12);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
      include: { role: true },
    });
    void logAuditEvent({ userId, username: user.username, action: 'SECURITY', entity: 'User', entityId: userId, newValues: { event: 'Password changed; all other sessions revoked' } });

    return { message: 'Password updated successfully', ...issueTokens(updated) };
  }
}
