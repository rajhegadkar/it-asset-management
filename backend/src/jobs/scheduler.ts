import cron from 'node-cron';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { sendTemplatedEmail } from '../services/notificationTemplates.js';
import { DisasterRecoveryService } from '../disasterRecovery/index.js';

async function activeAdmins() {
  return prisma.user.findMany({
    where: { isActive: true, role: { name: { in: ['SUPER_ADMIN', 'IT_ADMIN'] } } },
    select: { id: true, email: true },
  });
}

/** True if this notification was already sent to this user in the last `hours`. */
async function alreadyNotified(userId: string, type: string, title: string, hours = 20) {
  const since = new Date(Date.now() - hours * 3600 * 1000);
  return !!(await prisma.notification.findFirst({ where: { userId, type, title, createdAt: { gte: since } }, select: { id: true } }));
}

export class JobScheduler {
  private static isRunning = false;

  /**
   * Initializes all background cron schedules
   */
  static init() {
    if (!env.SCHEDULER_ENABLED) {
      logger.info('⏰ Background scheduler disabled on this instance (SCHEDULER_ENABLED=false).');
      return;
    }
    logger.info('⏰ Initializing Enterprise ITAM Background Job Scheduler...');

    // Run daily at midnight (0 0 * * *) or for testing every hour
    cron.schedule('0 0 * * *', async () => {
      logger.info('🕒 Running scheduled daily compliance and maintenance checks...');
      await this.checkExpiringWarranties();
      await this.checkExpiringLicenses();
      await this.checkLowStockConsumables();
    });

    // Run SLA monitor every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      await this.checkTicketSlaBreaches();
    });

    // Run Automated Disaster Recovery Snapshot & Cloud Sync every hour
    cron.schedule('0 * * * *', async () => {
      await this.runAutomatedDisasterRecoveryBackup();
    });

    this.isRunning = true;
    logger.info('✅ Background Job Scheduler initialized and active.');
  }

  /**
   * Check warranties expiring in 90, 30, and 7 days
   */
  static async checkExpiringWarranties() {
    try {
      const thresholds = [90, 30, 7];
      for (const days of thresholds) {
        const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const dayBefore = new Date(Date.now() + (days - 1) * 24 * 60 * 60 * 1000);

        const assets = await prisma.asset.findMany({
          where: {
            isArchived: false,
            warrantyEnd: {
              gte: dayBefore,
              lte: targetDate,
            },
          },
          include: { currentEmployee: true },
        });

        if (assets.length > 0) {
          logger.info(`🔔 Found ${assets.length} assets with warranty expiring in ${days} days`);

          // Notify IT Admin users
          const itAdmins = await activeAdmins();
          const title = `Warranty Expiry Alert (${days} Days)`;

          for (const admin of itAdmins) {
            if (await alreadyNotified(admin.id, 'WARRANTY_EXPIRING', title)) continue;
            await prisma.notification.create({
              data: {
                userId: admin.id,
                type: 'WARRANTY_EXPIRING',
                title,
                message: `${assets.length} asset(s) warranty will expire in approx ${days} days. Review required.`,
                link: '/reports',
              },
            });
          }
          for (const a of assets.slice(0, 50)) {
            await sendTemplatedEmail('WARRANTY_EXPIRING', 'expiry', itAdmins.map((x) => x.email), {
              assetName: a.name,
              assetTag: a.assetTag,
              serialNumber: a.serialNumber,
              expiryDate: a.warrantyEnd ? a.warrantyEnd.toISOString().slice(0, 10) : '',
              daysRemaining: days,
              vendorName: '',
            });
          }
        }
      }
    } catch (err) {
      logger.error('Error during warranty expiry check job:', err);
    }
  }

  /**
   * Check software licenses expiring in 30 days
   */
  static async checkExpiringLicenses() {
    try {
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const licenses = await prisma.softwareLicense.findMany({
        where: {
          expiryDate: {
            gte: new Date(),
            lte: thirtyDays,
          },
        },
      });

      if (licenses.length > 0) {
        logger.info(`🔔 Found ${licenses.length} software licenses expiring within 30 days`);
        const itAdmins = await prisma.user.findMany({
          where: { role: { name: { in: ['SUPER_ADMIN', 'IT_ADMIN'] } } },
        });

        for (const admin of itAdmins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              type: 'LICENSE_EXPIRING',
              title: 'Software License Renewal Alert',
              message: `${licenses.length} software licenses are approaching expiration within 30 days.`,
              link: '/licenses',
            },
          });
        }
      }
    } catch (err) {
      logger.error('Error during software license expiry job:', err);
    }
  }

  /**
   * Check consumable items falling below minimum inventory thresholds
   */
  static async checkLowStockConsumables() {
    try {
      const lowStock = await prisma.consumable.findMany({
        where: { stockQuantity: { lte: prisma.consumable.fields.minQuantity } },
        select: { name: true, stockQuantity: true, minQuantity: true },
      });
      if (lowStock.length > 0) {
        logger.warn(`⚠️ Alert: ${lowStock.length} consumable items are at or below minimum threshold!`);
        const title = 'Daily Low Stock Summary';
        const list = lowStock.slice(0, 10).map((i) => `${i.name} (${i.stockQuantity}/${i.minQuantity})`).join(', ');
        for (const admin of await activeAdmins()) {
          if (await alreadyNotified(admin.id, 'LOW_STOCK', title)) continue;
          await prisma.notification.create({
            data: {
              userId: admin.id,
              type: 'LOW_STOCK',
              title,
              message: `${lowStock.length} item(s) at or below minimum stock: ${list}${lowStock.length > 10 ? '…' : ''}`,
              link: '/consumables',
            },
          });
        }
      }
    } catch (err) {
      logger.error('Error during low-stock consumable job:', err);
    }
  }

  /**
   * SLA breach monitor: notifies the assigned engineer (or all active admins when unassigned)
   * once per breach, and escalates critical/high tickets to admins as well.
   */
  static async checkTicketSlaBreaches() {
    try {
      const breachedTickets = await prisma.ticket.findMany({
        where: {
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_VENDOR', 'REOPENED'] },
          slaDueDate: { lte: new Date() },
          slaBreachNotifiedAt: null,
        },
        select: { id: true, ticketNumber: true, subject: true, priority: true, assignedEngineerId: true, organizationId: true },
      });
      if (breachedTickets.length === 0) return;
      logger.warn(`⚠️ SLA Alert: ${breachedTickets.length} tickets have exceeded due SLA timeline.`);
      const admins = await activeAdmins();
      for (const t of breachedTickets) {
        const recipients = new Set<string>();
        if (t.assignedEngineerId) recipients.add(t.assignedEngineerId);
        if (!t.assignedEngineerId || t.priority === 'CRITICAL' || t.priority === 'HIGH') admins.forEach((a) => recipients.add(a.id));
        if (recipients.size) {
          await prisma.notification.createMany({
            data: Array.from(recipients).map((userId) => ({
              userId,
              organizationId: t.organizationId,
              type: 'SLA_BREACH',
              title: `SLA breached: ${t.ticketNumber} (${t.priority})`,
              message: t.subject,
              link: `/tickets?id=${t.id}`,
            })),
          });
        }
        await prisma.ticket.update({ where: { id: t.id }, data: { slaBreachNotifiedAt: new Date() } });
      }
    } catch (err) {
      logger.error('Error during ticket SLA monitoring job:', err);
    }
  }

  /**
   * Automated Disaster Recovery Snapshot & Cloud Sync
   */
  static async runAutomatedDisasterRecoveryBackup() {
    try {
      const config = await DisasterRecoveryService.getConfig();
      if (!config.enabled) return;

      const now = new Date();
      const currentHour = now.getHours();
      const currentDayOfWeek = now.getDay(); // 0 is Sunday
      const currentDayOfMonth = now.getDate(); // 1-31

      // Parse scheduledTime e.g. "02:00" -> hour 2
      const [schedHourStr] = (config.scheduledTime || '02:00').split(':');
      const targetHour = parseInt(schedHourStr, 10) || 2;

      let shouldRun = false;
      switch (config.frequency) {
        case 'HOURLY':
          shouldRun = true;
          break;
        case 'DAILY':
          shouldRun = currentHour === targetHour;
          break;
        case 'WEEKLY':
          shouldRun = currentDayOfWeek === 0 && currentHour === targetHour; // Every Sunday at scheduledTime
          break;
        case 'MONTHLY':
          shouldRun = currentDayOfMonth === 1 && currentHour === targetHour; // 1st of month at scheduledTime
          break;
        case 'MANUAL':
        default:
          shouldRun = false;
          break;
      }

      if (shouldRun) {
        logger.info(`🛡️ [DR SCHEDULER] Triggering automated disaster recovery backup (Frequency: ${config.frequency}, Provider: ${config.provider})...`);
        const { manifest, filename } = await DisasterRecoveryService.createBackup({ id: 'SYSTEM_SCHEDULER', email: 'system@itam.local' });
        logger.info(`✅ [DR SCHEDULER] Automated backup completed: ${filename} (SHA256: ${manifest.checksumSha256.substring(0, 10)}...)`);
      }
    } catch (err) {
      logger.error('❌ [DR SCHEDULER] Automated disaster recovery backup failed:', err);
    }
  }

  static getStatus() {
    return {
      active: this.isRunning,
      timestamp: new Date(),
    };
  }
}
