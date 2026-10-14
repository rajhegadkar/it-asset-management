import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { JobScheduler } from '../jobs/scheduler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { EmailService } from '../utils/emailService.js';
import { BrandingEngine } from '../customization/brandingEngine.js';

export class SettingsNotificationController {
  // --- System Settings ---
  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await prisma.systemSetting.findMany({
        orderBy: { key: 'asc' },
      });
      return ApiResponse.success(res, settings, 'System settings retrieved');
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
        await prisma.systemSetting.upsert({
          where: { key: item.key },
          update: { value: item.value, group: item.group || 'GENERAL' },
          create: { key: item.key, value: item.value, group: item.group || 'GENERAL' },
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
      if (smtpPass && smtpPass !== '••••••••') {
        finalPass = smtpPass;
      }

      const settingsMap: Record<string, string> = {
        'email.provider': provider || 'custom',
        'email.smtp_host': smtpHost || '',
        'email.smtp_port': smtpPort ? smtpPort.toString() : '587',
        'email.smtp_secure': smtpSecure ? 'true' : 'false',
        'email.smtp_user': smtpUser || '',
        'email.smtp_pass': finalPass || '',
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
      return ApiResponse.success(res, null, 'Email settings updated successfully');
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
          smtpPass: config.smtpPass === '••••••••' ? current.smtpPass : config.smtpPass,
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
      await prisma.notification.update({
        where: { id: req.params.id },
        data: { isRead: true },
      });
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

  // --- System Health ---
  static async getHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const dbCheck = await prisma.$queryRaw`SELECT 1 as alive`;
      const schedulerStatus = JobScheduler.getStatus();

      return ApiResponse.success(res, {
        status: 'UP',
        version: '1.0.0',
        uptime: process.uptime(),
        database: 'CONNECTED',
        scheduler: schedulerStatus,
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      }, 'System health status');
    } catch (error) {
      return ApiResponse.error(res, 'System health check failed', 503, 'SERVICE_UNAVAILABLE', [error]);
    }
  }
}
