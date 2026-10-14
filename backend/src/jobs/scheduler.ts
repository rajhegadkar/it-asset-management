import cron from 'node-cron';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { EmailService } from '../utils/emailService.js';
import { DisasterRecoveryService } from '../disasterRecovery/index.js';

export class JobScheduler {
  private static isRunning = false;

  /**
   * Initializes all background cron schedules
   */
  static init() {
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
          const itAdmins = await prisma.user.findMany({
            where: {
              role: { name: { in: ['SUPER_ADMIN', 'IT_ADMIN'] } },
            },
          });

          for (const admin of itAdmins) {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                type: 'WARRANTY_EXPIRING',
                title: `Warranty Expiry Alert (${days} Days)`,
                message: `${assets.length} asset(s) warranty will expire in approx ${days} days. Review required.`,
                link: '/reports/warranty',
              },
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
      const items = await prisma.consumable.findMany();
      const lowStock = items.filter((item) => item.stockQuantity <= item.minQuantity);

      if (lowStock.length > 0) {
        logger.warn(`⚠️ Alert: ${lowStock.length} consumable items are at or below minimum threshold!`);
      }
    } catch (err) {
      logger.error('Error during low-stock consumable job:', err);
    }
  }

  /**
   * Monitor Helpdesk tickets nearing SLA breach
   */
  static async checkTicketSlaBreaches() {
    try {
      const breachedTickets = await prisma.ticket.findMany({
        where: {
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
          slaDueDate: { lte: new Date() },
        },
        include: { assignedEngineer: true },
      });

      if (breachedTickets.length > 0) {
        logger.warn(`⚠️ SLA Alert: ${breachedTickets.length} tickets have exceeded due SLA timeline.`);
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
