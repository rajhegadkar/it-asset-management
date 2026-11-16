import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { JobScheduler } from '../jobs/scheduler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { EmailService } from '../utils/emailService.js';
import { BrandingEngine } from '../customization/brandingEngine.js';
import { SecretBox, SECRET_MASK } from '../utils/secretBox.js';
import { verifyAuditChain } from '../middlewares/audit.js';

// Settings that hold secrets: encrypted at rest, masked on read
const SECRET_SETTING_KEYS = new Set(['email.smtp_pass']);
// Settings managed by their own endpoints (validated there); not writable through the generic API
const PROTECTED_PREFIXES = ['disaster_recovery.', 'customization.'];

export class SettingsNotificationController {
  // --- System Settings ---
  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await prisma.systemSetting.findMany({
        orderBy: { key: 'asc' },
      });
      const safe = settings.map((st) => {
        if (SECRET_SETTING_KEYS.has(st.key)) return { ...st, value: st.value ? SECRET_MASK : '' };
        if (st.key === 'disaster_recovery.config') return { ...st, value: '[managed in Disaster Recovery Center]' };
        return st;
      });
      return ApiResponse.success(res, safe, 'System settings retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const updates: Array<{ key: string; value: string; group?: string }> = req.body;
      if (!Array.isArray(updates)) {
        return ApiResponse.error(res, 'Request body must be an array of key-value pairs', 400);
      }

      for (const item of updates) {
        if (!item || typeof item.key !== 'string' || !/^[a-zA-Z0-9_.-]{1,100}$/.test(item.key)) {
          return ApiResponse.error(res, `Invalid setting key: ${item?.key}`, 400, 'VALIDATION_ERROR');
        }
        if (PROTECTED_PREFIXES.some((p) => item.key.startsWith(p))) continue;
        let value = item.value === undefined || item.value === null ? '' : String(item.value);
        if (SECRET_SETTING_KEYS.has(item.key)) {
          if (SecretBox.isMasked(value)) continue; // unchanged
          value = SecretBox.encrypt(value);
        }
        await prisma.systemSetting.upsert({
          where: { key: item.key },
          update: { value, group: item.group || 'GENERAL' },
          create: { key: item.key, value, group: item.group || 'GENERAL' },
        });

        if (item.key === 'company.name' && item.value) {
          try {
            await prisma.organization.updateMany({
              data: { name: item.value },
            });
            await BrandingEngine.updateBranding({ companyName: item.value });
          } catch (e) {
            console.warn('Failed to sync company.name with Organization/BrandingEngine:', e);
          }
        }

        if (item.key === 'company.currency' && item.value) {
          try {
            const code = item.value.trim().toUpperCase();
            await BrandingEngine.updateBranding({ currencyCode: code });
          } catch (e) {
            console.warn('Failed to sync company.currency with BrandingEngine:', e);
          }
        }
      }

      return ApiResponse.success(res, null, 'Settings updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // --- Email Settings & Testing ---
  static async getEmailSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await EmailService.getConfig();
      const safeConfig = {
        ...config,
        smtpPass: config.smtpPass ? '••••••••' : '',
        hasPassword: !!config.smtpPass,
      };
      return ApiResponse.success(res, safeConfig, 'Email configuration retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async updateEmailSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        provider,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        fromName,
        fromEmail,
        enableTls,
        notificationsEnabled,
        notifyOnAllocation,
        notifyOnReturn,
        notifyOnTicket,
        notifyOnMaintenance,
        notifyOnExpiry,
      } = req.body;

      const currentConfig = await EmailService.getConfig();
      let finalPass = currentConfig.smtpPass;
      if (smtpPass && !SecretBox.isMasked(smtpPass)) {
        finalPass = smtpPass;
      }

      const settingsMap: Record<string, string> = {
        'email.provider': provider || 'custom',
        'email.smtp_host': smtpHost || '',
        'email.smtp_port': smtpPort ? smtpPort.toString() : '587',
        'email.smtp_secure': smtpSecure ? 'true' : 'false',
        'email.smtp_user': smtpUser || '',
        'email.smtp_pass': SecretBox.encrypt(finalPass || ''),
        'email.from_name': fromName || 'IT Asset Management v2.0',
        'email.from_email': fromEmail || 'noreply@itam.local',
        'email.enable_tls': enableTls !== false ? 'true' : 'false',
        'email.notifications_enabled': notificationsEnabled !== false ? 'true' : 'false',
        'email.notify_allocation': notifyOnAllocation !== false ? 'true' : 'false',
        'email.notify_return': notifyOnReturn !== false ? 'true' : 'false',
        'email.notify_ticket': notifyOnTicket !== false ? 'true' : 'false',
        'email.notify_maintenance': notifyOnMaintenance !== false ? 'true' : 'false',
        'email.notify_expiry': notifyOnExpiry !== false ? 'true' : 'false',
      };

      for (const [key, value] of Object.entries(settingsMap)) {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value, group: 'EMAIL' },
          create: { key, value, group: 'EMAIL' },
        });
      }

      EmailService.resetTransporter();
      const updatedConfig = await EmailService.getConfig();
      return ApiResponse.success(
        res,
        { ...updatedConfig, smtpPass: updatedConfig.smtpPass ? SECRET_MASK : '', hasPassword: !!updatedConfig.smtpPass },
        'Email settings updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async testEmailConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const { to, config } = req.body;
      const targetEmail = to || req.user?.email || 'admin@acme-corp.com';

      let testConfig: any = undefined;
      if (config) {
        const current = await EmailService.getConfig();
        testConfig = {
          ...config,
          smtpPass: SecretBox.isMasked(config.smtpPass) ? current.smtpPass : config.smtpPass,
        };
      }

      const result = await EmailService.testConnection(targetEmail, testConfig);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400, 'SMTP_TEST_FAILED', result.details);
      }

      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // --- Notifications ---
  static async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const unreadCount = await prisma.notification.count({
        where: { userId: req.user!.id, isRead: false },
      });

      return ApiResponse.success(res, { notifications, unreadCount }, 'Notifications retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async markNotificationRead(req: Request, res: Response, next: NextFunction) {
    try {
      // Only the owner can mark a notification read
      const result = await prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user!.id },
        data: { isRead: true },
      });
      if (result.count === 0) return ApiResponse.error(res, 'Notification not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, null, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }

  static async markAllNotificationsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user!.id, isRead: false },
        data: { isRead: true },
      });
      return ApiResponse.success(res, null, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }

  // --- Audit Logs ---
  static async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { entity, action, page, limit } = req.query;
      const p = Math.max(1, page ? parseInt(page as string, 10) : 1);
      const l = Math.min(100, Math.max(1, limit ? parseInt(limit as string, 10) : 50));
      const skip = (p - 1) * l;

      const where: any = {};
      if (entity) where.entity = entity as string;
      if (action) where.action = action as string;

      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          skip,
          take: l,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return ApiResponse.success(res, logs, 'Audit logs retrieved', 200, {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l),
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await verifyAuditChain();
      return ApiResponse.success(res, result, result.valid ? 'Audit trail intact' : 'Audit trail has been altered');
    } catch (error) {
      next(error);
    }
  }

  // --- System Health (public: minimal information only) ---
  static async getHealth(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.$queryRaw`SELECT 1 as alive`;
      const schedulerStatus = JobScheduler.getStatus();
      return ApiResponse.success(res, {
        status: 'UP',
        version: '2.3.0',
        database: 'CONNECTED',
        scheduler: { active: schedulerStatus.active },
        timestamp: new Date().toISOString(),
      }, 'System health status');
    } catch (error) {
      return ApiResponse.error(res, 'System health check failed', 503, 'SERVICE_UNAVAILABLE');
    }
  }

  /** Detailed health for the Super Admin settings page (memory, uptime, scheduler). */
  static async getHealthDetails(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.$queryRaw`SELECT 1 as alive`;
      return ApiResponse.success(res, {
        status: 'UP',
        version: '2.3.0',
        uptime: process.uptime(),
        database: 'CONNECTED',
        scheduler: JobScheduler.getStatus(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      }, 'System health status');
    } catch (error) {
      next(error);
    }
  }
}
