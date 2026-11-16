import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * AES-256-GCM encryption for secrets stored in the database
 * (SMTP password, cloud backup credentials, software license keys).
 *
 * Key: SETTINGS_ENCRYPTION_KEY (recommended) or, as a fallback, JWT_SECRET.
 * Changing the key makes previously stored secrets unreadable, so set
 * SETTINGS_ENCRYPTION_KEY once and keep it with your other production secrets.
 *
 * Values written before this change (plain text) are still readable: decrypt()
 * returns any value without the "enc:v1:" prefix unchanged.
 */
const PREFIX = 'enc:v1:';
export const SECRET_MASK = '••••••••';

function key(): Buffer {
  const material = env.SETTINGS_ENCRYPTION_KEY || env.JWT_SECRET;
  return crypto.createHash('sha256').update(`itam-secret-box:${material}`).digest();
}

export const SecretBox = {
  isEncrypted(value?: string | null): boolean {
    return !!value && value.startsWith(PREFIX);
  },

  encrypt(plain?: string | null): string {
    if (plain === undefined || plain === null || plain === '') return '';
    if (plain.startsWith(PREFIX)) return plain;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
  },

  decrypt(value?: string | null): string {
    if (!value) return '';
    if (!value.startsWith(PREFIX)) return value; // legacy plain text
    try {
      const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
      const iv = raw.subarray(0, 12);
      const tag = raw.subarray(12, 28);
      const data = raw.subarray(28);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
      return '';
    }
  },

  /** Masks a secret for display: keeps the last 4 characters of long values. */
  mask(plain?: string | null, keepLast = 0): string {
    if (!plain) return '';
    if (keepLast > 0 && plain.length > keepLast + 4) return `${SECRET_MASK}${plain.slice(-keepLast)}`;
    return SECRET_MASK;
  },

  /** True if a value sent back by the UI is just the mask (i.e. "unchanged"). */
  isMasked(value?: string | null): boolean {
    return !!value && value.includes('••••');
  },
};
