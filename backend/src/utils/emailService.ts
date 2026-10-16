import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/db.js';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}

export interface EmailConfigData {
  provider: 'custom' | 'google_workspace' | 'office_365';
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  enableTls: boolean;
  notificationsEnabled: boolean;
  notifyOnAllocation: boolean;
  notifyOnReturn: boolean;
  notifyOnTicket: boolean;
  notifyOnMaintenance: boolean;
  notifyOnExpiry: boolean;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;
  private static cachedConfig: EmailConfigData | null = null;
  private static cacheTime: number = 0;

  /**
   * Clears cached transporter and configuration
   */
  static resetTransporter(): void {
    this.transporter = null;
    this.cachedConfig = null;
    this.cacheTime = 0;
  }

  /**
   * Fetches email configuration from database SystemSettings, falling back to environment variables
   */
  static async getConfig(): Promise<EmailConfigData> {
    const now = Date.now();
    if (this.cachedConfig && now - this.cacheTime < 60000) {
      return this.cachedConfig;
    }

    try {
      const settings = await prisma.systemSetting.findMany({
        where: { group: 'EMAIL' },
      });

      const map = new Map<string, string>(settings.map((s) => [s.key, s.value]));

      const provider = (map.get('email.provider') || 'custom') as EmailConfigData['provider'];
      const defaultHost =
        provider === 'google_workspace'
          ? 'smtp.gmail.com'
          : provider === 'office_365'
          ? 'smtp.office365.com'
          : env.SMTP_HOST || 'localhost';

      const defaultPort = provider === 'office_365' ? 587 : provider === 'google_workspace' ? 587 : env.SMTP_PORT || 587;

      const config: EmailConfigData = {
        provider,
        smtpHost: map.get('email.smtp_host') || defaultHost,
        smtpPort: map.has('email.smtp_port') ? parseInt(map.get('email.smtp_port')!, 10) : defaultPort,
        smtpSecure: map.get('email.smtp_secure') === 'true' || (map.has('email.smtp_secure') ? false : env.SMTP_SECURE),
        smtpUser: map.get('email.smtp_user') || env.SMTP_USER || '',
        smtpPass: map.get('email.smtp_pass') || env.SMTP_PASS || '',
        fromName: map.get('email.from_name') || 'IT Asset Management v1.0',
        fromEmail: map.get('email.from_email') || env.SMTP_FROM || 'noreply@itam.local',
        enableTls: map.get('email.enable_tls') !== 'false',
        notificationsEnabled: map.get('email.notifications_enabled') !== 'false',
        notifyOnAllocation: map.get('email.notify_allocation') !== 'false',
        notifyOnReturn: map.get('email.notify_return') !== 'false',
        notifyOnTicket: map.get('email.notify_ticket') !== 'false',
        notifyOnMaintenance: map.get('email.notify_maintenance') !== 'false',
        notifyOnExpiry: map.get('email.notify_expiry') !== 'false',
      };

      this.cachedConfig = config;
      this.cacheTime = now;
      return config;
    } catch {
      // Fallback if db is unavailable
      return {
        provider: 'custom',
        smtpHost: env.SMTP_HOST || 'localhost',
        smtpPort: env.SMTP_PORT || 587,
        smtpSecure: env.SMTP_SECURE,
        smtpUser: env.SMTP_USER || '',
        smtpPass: env.SMTP_PASS || '',
        fromName: 'IT Asset Management v1.0',
        fromEmail: env.SMTP_FROM || 'noreply@itam.local',
        enableTls: true,
        notificationsEnabled: true,
        notifyOnAllocation: true,
        notifyOnReturn: true,
        notifyOnTicket: true,
        notifyOnMaintenance: true,
        notifyOnExpiry: true,
      };
    }
  }

  /**
   * Builds an optimized nodemailer transporter for Google Workspace, Office 365, or Custom SMTP
   */
  static async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    const config = await this.getConfig();

    const transportOptions: nodemailer.TransportOptions = {
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
      auth: config.smtpUser
        ? {
            user: config.smtpUser,
            pass: config.smtpPass,
          }
        : undefined,
    } as any;

    if (config.provider === 'office_365') {
      // Office 365 Outlook specific requirements (TLS 1.2, STARTTLS ciphers)
      (transportOptions as any).requireTLS = true;
      (transportOptions as any).tls = {
        ciphers: 'SSLv3',
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      };
    } else if (config.provider === 'google_workspace') {
      // Google Workspace requirements
      (transportOptions as any).tls = {
        rejectUnauthorized: false,
      };
    } else if (config.enableTls) {
      (transportOptions as any).tls = {
        rejectUnauthorized: false,
      };
    }

    this.transporter = nodemailer.createTransport(transportOptions as any);
    return this.transporter;
  }

  /**
   * Dispatch email with fallback logging if credentials are not configured or in test mode
   */
  static async sendMail(options: EmailOptions, category?: 'allocation' | 'return' | 'ticket' | 'maintenance' | 'expiry'): Promise<boolean> {
    try {
      const config = await this.getConfig();

      // Check master switch
      if (!config.notificationsEnabled) {
        logger.info(`📧 [EMAIL SKIPPED] Notifications globally disabled. To: ${options.to}`);
        return true;
      }

      // Check category switch if specified
      if (category === 'allocation' && !config.notifyOnAllocation) return true;
      if (category === 'return' && !config.notifyOnReturn) return true;
      if (category === 'ticket' && !config.notifyOnTicket) return true;
      if (category === 'maintenance' && !config.notifyOnMaintenance) return true;
      if (category === 'expiry' && !config.notifyOnExpiry) return true;

      // Mock in test or if credentials are empty
      if (!config.smtpUser || env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
        logger.info(`📧 [MOCK EMAIL DISPATCH] To: ${options.to} | Subject: ${options.subject}`);
        return true;
      }

      const transporter = await this.getTransporter();
      const fromHeader = config.fromEmail.includes('<')
        ? config.fromEmail
        : `"${config.fromName}" <${config.fromEmail}>`;

      await transporter.sendMail({
        from: fromHeader,
        to: options.to,
        subject: options.subject,
        text: options.text || options.subject,
        html: options.html,
        attachments: options.attachments,
      });

      logger.info(`📧 [EMAIL SENT] [${config.provider.toUpperCase()}] To: ${options.to} | Subject: ${options.subject}`);
      return true;
    } catch (error: any) {
      logger.error('❌ Failed to send email:', error?.message || error);
      return false;
    }
  }

  /**
   * Validates and verifies SMTP configuration and sends a live verification test email
   */
  static async testConnection(recipientEmail: string, testConfig?: Partial<EmailConfigData>): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const current = await this.getConfig();
      const config: EmailConfigData = {
        ...current,
        ...(testConfig || {}),
      };

      if (!config.smtpHost) {
        return { success: false, message: 'SMTP Host cannot be empty.' };
      }
      if (!config.smtpUser) {
        return { success: false, message: 'SMTP Username / Mailbox Email is required.' };
      }
      if (!config.smtpPass) {
        return { success: false, message: 'SMTP Password / App Password is required.' };
      }

      const transportOptions: any = {
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
      };

      if (config.provider === 'office_365') {
        transportOptions.requireTLS = true;
        transportOptions.tls = {
          ciphers: 'SSLv3',
          minVersion: 'TLSv1.2',
          rejectUnauthorized: false,
        };
      } else {
        transportOptions.tls = {
          rejectUnauthorized: false,
        };
      }

      const testTransporter = nodemailer.createTransport(transportOptions);

      // Verify handshake
      await testTransporter.verify();

      // Dispatch test message
      const fromHeader = config.fromEmail.includes('<')
        ? config.fromEmail
        : `"${config.fromName}" <${config.fromEmail}>`;

      const providerLabel =
        config.provider === 'google_workspace'
          ? 'Google Workspace (Gmail)'
          : config.provider === 'office_365'
          ? 'Microsoft 365 / Office 365 Outlook'
          : 'Custom SMTP Server';

      const testHtml = this.wrapTemplate(
        'Email Notification System Test Successful',
        `
          <p>Hello,</p>
          <p>This is a confirmation that your <strong>IT Asset Management v1.0</strong> email notification service is properly configured and communicating with your mail provider.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b; width: 140px;">Mail Provider:</td>
              <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${providerLabel}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">SMTP Host & Port:</td>
              <td style="padding: 8px 0; font-family: monospace; color: #0f172a;">${config.smtpHost}:${config.smtpPort}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Encryption:</td>
              <td style="padding: 8px 0; color: #0f172a;">${config.smtpSecure ? 'SSL (Direct)' : 'TLS / STARTTLS'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Authenticated User:</td>
              <td style="padding: 8px 0; font-family: monospace; color: #0f172a;">${config.smtpUser}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Tested At:</td>
              <td style="padding: 8px 0; color: #0f172a;">${new Date().toUTCString()}</td>
            </tr>
          </table>
          <p style="color: #059669; font-weight: 600;">✓ Ready to deliver automated employee handover receipts, return notices, and helpdesk SLA alerts.</p>
        `,
        config.fromName
      );

      await testTransporter.sendMail({
        from: fromHeader,
        to: recipientEmail,
        subject: `[TEST SUCCESS] ITAM v1.0 Email Service Active (${providerLabel})`,
        html: testHtml,
        text: `ITAM v1.0 Email Test Successful. Dispatched via ${providerLabel} to ${recipientEmail}.`,
      });

      return {
        success: true,
        message: `Test email successfully sent to ${recipientEmail} via ${providerLabel}!`,
      };
    } catch (err: any) {
      logger.error('SMTP test connection failed:', err);
      let errorMsg = err?.message || 'SMTP Handshake or Authentication failed.';

      if (errorMsg.includes('Invalid login') || errorMsg.includes('Username and Password not accepted') || errorMsg.includes('535 5.7.8')) {
        errorMsg = 'Authentication Failed: Google Workspace / Gmail rejected credentials. Ensure you have 2-Step Verification enabled and are using a 16-character Google App Password (not your normal Google account password).';
      } else if (errorMsg.includes('535 5.7.139') || errorMsg.includes('Authentication unsuccessful') || errorMsg.includes('SmtpClientAuthentication is disabled')) {
        errorMsg = 'Authentication Failed: Microsoft 365 rejected SMTP AUTH. Please enable "Authenticated SMTP" for this mailbox in Microsoft 365 Admin Center, or generate an App Password.';
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNREFUSED')) {
        errorMsg = `Connection timed out or refused connecting to SMTP server. Verify hostname, port, and firewall rules.`;
      }

      return {
        success: false,
        message: errorMsg,
        details: err?.code || 'ERROR',
      };
    }
  }

  /**
   * Enterprise branded responsive HTML email template wrapper
   */
  static wrapTemplate(title: string, bodyContent: string, companyName: string = 'IT Asset Management'): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: #0f172a; padding: 28px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
          .header .badge { display: inline-block; font-size: 10px; font-weight: 700; color: #38bdf8; background: #1e293b; padding: 2px 8px; border-radius: 9999px; margin-top: 6px; letter-spacing: 1px; }
          .content { padding: 32px 28px; line-height: 1.6; font-size: 14px; }
          .content h2 { color: #0f172a; font-size: 18px; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
          .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
          .btn { display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }
          ul { padding-left: 20px; }
          li { margin-bottom: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${companyName}</h1>
            <span class="badge">ENTERPRISE ITAM v1.0</span>
          </div>
          <div class="content">
            <h2>${title}</h2>
            ${bodyContent}
          </div>
          <div class="footer">
            <p style="margin: 0 0 6px 0;">This is an automated operational notification from ${companyName}.</p>
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">Confidential Record • Enterprise IT Asset Management</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
