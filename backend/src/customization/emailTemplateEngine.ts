import { prisma } from '../config/db.js';
import { EmailTemplateConfig } from './types.js';

export const DEFAULT_EMAIL_TEMPLATES: Record<string, EmailTemplateConfig> = {
  ASSET_ALLOCATED: {
    id: 'tmpl-alloc',
    trigger: 'ASSET_ALLOCATED',
    name: 'Hardware Custody Allocation Notice',
    subject: 'IT Equipment Allocated: {{assetName}} (Tag: {{assetTag}})',
    availableTokens: ['assetName', 'assetTag', 'assetId', 'serialNumber', 'employeeName', 'allocationDate', 'returnExpectedDate', 'orgName', 'portalUrl'],
    enabled: true,
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
  <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #0f172a; margin: 0; font-size: 20px;">IT Hardware Custody Assignment</h2>
    <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">{{orgName}} IT Service Management</p>
  </div>
  <p style="font-size: 14px; color: #334155; line-height: 1.5;">Dear <strong>{{employeeName}}</strong>,</p>
  <p style="font-size: 14px; color: #334155; line-height: 1.5;">The following corporate IT asset has been successfully provisioned and allocated into your custody:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
    <tr style="background: #f8fafc;"><td style="padding: 10px; font-weight: 600; color: #475569; width: 40%; border: 1px solid #e2e8f0;">Equipment Model</td><td style="padding: 10px; color: #0f172a; border: 1px solid #e2e8f0;">{{assetName}}</td></tr>
    <tr><td style="padding: 10px; font-weight: 600; color: #475569; border: 1px solid #e2e8f0;">Asset Tag / Barcode</td><td style="padding: 10px; font-weight: bold; color: #2563eb; border: 1px solid #e2e8f0;">{{assetTag}}</td></tr>
    <tr style="background: #f8fafc;"><td style="padding: 10px; font-weight: 600; color: #475569; border: 1px solid #e2e8f0;">Serial Number</td><td style="padding: 10px; font-family: monospace; color: #0f172a; border: 1px solid #e2e8f0;">{{serialNumber}}</td></tr>
    <tr><td style="padding: 10px; font-weight: 600; color: #475569; border: 1px solid #e2e8f0;">Allocation Date</td><td style="padding: 10px; color: #0f172a; border: 1px solid #e2e8f0;">{{allocationDate}}</td></tr>
  </table>
  <p style="font-size: 13px; color: #475569;">Please sign and acknowledge custody receipt on your <a href="{{portalUrl}}" style="color: #2563eb; font-weight: 600;">Employee Portal</a>.</p>
</div>`,
  },
  ASSET_RETURNED: {
    id: 'tmpl-return',
    trigger: 'ASSET_RETURNED',
    name: 'Hardware Return Confirmation',
    subject: 'Equipment Returned to IT: {{assetName}} (Tag: {{assetTag}})',
    availableTokens: ['assetName', 'assetTag', 'serialNumber', 'employeeName', 'returnDate', 'condition', 'orgName', 'portalUrl'],
    enabled: true,
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
  <div style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Hardware Check-In Receipt</h2>
    <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">{{orgName}} IT Operations</p>
  </div>
  <p style="font-size: 14px; color: #334155;">Hello <strong>{{employeeName}}</strong>,</p>
  <p style="font-size: 14px; color: #334155;">This confirms that IT asset <strong>{{assetName}}</strong> [{{assetTag}}] has been successfully returned and checked back into enterprise stock in <em>{{condition}}</em> condition on {{returnDate}}.</p>
</div>`,
  },
  TICKET_CREATED: {
    id: 'tmpl-ticket-create',
    trigger: 'TICKET_CREATED',
    name: 'New Support Ticket Notification',
    subject: '[Ticket #{{ticketNumber}}] {{subject}}',
    availableTokens: ['ticketNumber', 'subject', 'priority', 'category', 'requesterName', 'assetTag', 'createdAt', 'portalUrl'],
    enabled: true,
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
  <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">Support Ticket Logged: #{{ticketNumber}}</h2>
  <p style="font-size: 14px; color: #334155;">Your issue <strong>"{{subject}}"</strong> has been queued with priority <strong>{{priority}}</strong>.</p>
</div>`,
  },
  TICKET_RESOLVED: {
    id: 'tmpl-ticket-res',
    trigger: 'TICKET_RESOLVED',
    name: 'Ticket Resolved Notification',
    subject: '[Resolved] Ticket #{{ticketNumber}}: {{subject}}',
    availableTokens: ['ticketNumber', 'subject', 'requesterName', 'resolutionNotes', 'resolvedAt', 'portalUrl'],
    enabled: true,
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
  <h2 style="color: #10b981; font-size: 18px; margin-top: 0;">Support Ticket Resolved</h2>
  <p style="font-size: 14px; color: #334155;">Ticket #{{ticketNumber}} has been marked as resolved.</p>
</div>`,
  },
  WARRANTY_EXPIRING: {
    id: 'tmpl-warranty',
    trigger: 'WARRANTY_EXPIRING',
    name: 'Warranty Expiration Alert',
    subject: 'Action Required: Warranty Expiring for {{assetName}} ({{assetTag}})',
    availableTokens: ['assetName', 'assetTag', 'serialNumber', 'expiryDate', 'daysRemaining', 'vendorName'],
    enabled: true,
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
  <h2 style="color: #d97706; font-size: 18px; margin-top: 0;">Warranty Expiration Warning</h2>
  <p style="font-size: 14px; color: #334155;">The warranty contract for <strong>{{assetName}}</strong> (Tag: {{assetTag}}) will expire on <strong>{{expiryDate}}</strong> ({{daysRemaining}} days remaining).</p>
</div>`,
  },
  LOW_STOCK: {
    id: 'tmpl-stock',
    trigger: 'LOW_STOCK',
    name: 'Consumable Low Stock Alert',
    subject: 'Inventory Alert: Low Stock on {{itemName}}',
    availableTokens: ['itemName', 'itemCode', 'currentStock', 'minQuantity', 'locationName'],
    enabled: true,
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
  <h2 style="color: #ef4444; font-size: 18px; margin-top: 0;">Consumable Low Stock Threshold</h2>
  <p style="font-size: 14px; color: #334155;"><strong>{{itemName}}</strong> (Code: {{itemCode}}) has dropped to {{currentStock}} units, which is below the minimum threshold of {{minQuantity}}.</p>
</div>`,
  },
};

export class EmailTemplateEngine {
  private static getKey(trigger: string): string {
    return `customization.email.${trigger.toLowerCase()}`;
  }

  static async getTemplates(): Promise<Record<string, EmailTemplateConfig>> {
    const triggers = Object.keys(DEFAULT_EMAIL_TEMPLATES);
    const result: Record<string, EmailTemplateConfig> = {};

    for (const trig of triggers) {
      try {
        const key = this.getKey(trig);
        const setting = await prisma.systemSetting.findUnique({ where: { key } });
        if (setting && setting.value) {
          result[trig] = { ...DEFAULT_EMAIL_TEMPLATES[trig], ...JSON.parse(setting.value) };
          continue;
        }
      } catch (e) {
        console.warn(`Failed to read email template for ${trig}:`, e);
      }
      result[trig] = DEFAULT_EMAIL_TEMPLATES[trig];
    }
    return result;
  }

  static async updateTemplate(trigger: string, updates: Partial<EmailTemplateConfig>): Promise<EmailTemplateConfig> {
    const templates = await this.getTemplates();
    const current = templates[trigger] || DEFAULT_EMAIL_TEMPLATES[trigger];
    if (!current) {
      throw { statusCode: 404, message: `Email template for ${trigger} not found`, code: 'TEMPLATE_NOT_FOUND' };
    }

    const updated: EmailTemplateConfig = {
      ...current,
      ...updates,
    };

    const key = this.getKey(trigger);
    await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(updated),
        group: 'EMAIL_TEMPLATES',
      },
      create: {
        key,
        value: JSON.stringify(updated),
        group: 'EMAIL_TEMPLATES',
      },
    });

    return updated;
  }

  static render(template: EmailTemplateConfig, variables: Record<string, any>): { subject: string; html: string } {
    let subject = template.subject;
    let html = template.htmlBody;

    for (const [key, val] of Object.entries(variables)) {
      const reg = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const valStr = val !== undefined && val !== null ? String(val) : '';
      subject = subject.replace(reg, valStr);
      html = html.replace(reg, valStr);
    }

    return { subject, html };
  }
}
