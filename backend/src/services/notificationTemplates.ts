import { EmailTemplateEngine } from '../customization/emailTemplateEngine.js';
import { EmailService } from '../utils/emailService.js';
import { escapeHtml } from '../utils/sanitize.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

type Trigger = 'ASSET_ALLOCATED' | 'ASSET_RETURNED' | 'TICKET_CREATED' | 'TICKET_RESOLVED' | 'WARRANTY_EXPIRING' | 'LOW_STOCK';
type Category = 'allocation' | 'return' | 'ticket' | 'maintenance' | 'expiry';

/**
 * Sends an e-mail using the template configured in the Customization Center.
 * - Every variable is HTML-escaped before substitution (no HTML injection via names, subjects, etc.).
 * - Honours the template's "enabled" switch and the per-event toggle in Settings & Mail.
 * - Never throws: notification failures must not roll back business operations.
 */
export async function sendTemplatedEmail(
  trigger: Trigger,
  category: Category | undefined,
  to: string | string[] | null | undefined,
  variables: Record<string, any>
): Promise<void> {
  try {
    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean) as string[];
    if (recipients.length === 0) return;
    const templates = await EmailTemplateEngine.getTemplates();
    const tmpl = templates[trigger];
    if (!tmpl || tmpl.enabled === false) return;

    const safeVars: Record<string, string> = { portalUrl: env.APP_URL };
    for (const [k, v] of Object.entries(variables)) safeVars[k] = escapeHtml(v);
    const { subject, html } = EmailTemplateEngine.render(tmpl, safeVars);
    // Subject is plain text: undo entity escaping there
    const plainSubject = subject
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/[\r\n]+/g, ' ');

    for (const r of recipients) {
      await EmailService.sendMail({ to: r, subject: plainSubject, html }, category);
    }
  } catch (e) {
    logger.error(`Failed to send ${trigger} notification:`, e);
  }
}
