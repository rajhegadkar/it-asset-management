import dotenv from 'dotenv';
import path from 'path';

import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL || 'file:./dev.db';
  if (raw.startsWith('file:')) {
    const rawPath = raw.slice(5);
    if (!path.isAbsolute(rawPath)) {
      const filename = path.basename(rawPath);
      const inPrisma = path.resolve(__dirname, '../../prisma', filename);
      const inCwd = path.resolve(process.cwd(), rawPath);
      const selected = fs.existsSync(inPrisma) ? inPrisma : (fs.existsSync(inCwd) ? inCwd : inPrisma);
      const finalUrl = `file:${selected.replace(/\\/g, '/')}`;
      process.env.DATABASE_URL = finalUrl;
      return finalUrl;
    }
  }
  return raw;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

// Known placeholder secrets that must never be used in production.
const WEAK_SECRETS = new Set([
  '',
  'dev_secret_jwt_key_itam_2026',
  'dev_secret_refresh_key_itam_2026',
  'production_secure_jwt_secret_change_me_9921',
  'production_secure_refresh_jwt_secret_9921',
  'change_me',
]);

function requireSecret(name: string, devFallback: string): string {
  const value = process.env[name] || '';
  if (IS_PROD && (WEAK_SECRETS.has(value) || value.length < 32)) {
    // Fail fast: running production with a guessable signing key lets anyone mint admin tokens.
    throw new Error(
      `[SECURITY] ${name} must be set to a random value of at least 32 characters in production. ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  return value || devFallback;
}

const corsRaw = process.env.CORS_ORIGIN || (IS_PROD ? '' : '*');

export const env = {
  NODE_ENV,
  IS_PROD,
  PORT: parseInt(process.env.PORT || '5000', 10),
  DATABASE_URL: resolveDatabaseUrl(),
  JWT_SECRET: requireSecret('JWT_SECRET', 'dev_secret_jwt_key_itam_2026'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_SECRET: requireSecret('JWT_REFRESH_SECRET', 'dev_secret_refresh_key_itam_2026'),
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  /** Key used to encrypt secrets stored in the DB. Falls back to JWT_SECRET; set it explicitly in production. */
  SETTINGS_ENCRYPTION_KEY: process.env.SETTINGS_ENCRYPTION_KEY || '',
  /** Key used to sign and encrypt backup archives. Falls back to SETTINGS_ENCRYPTION_KEY / JWT_SECRET. */
  BACKUP_ENCRYPTION_KEY: process.env.BACKUP_ENCRYPTION_KEY || '',
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
  CORS_ORIGIN: corsRaw.split(',').map((s) => s.trim()).filter(Boolean),
  /** Set to "false" on all but one instance when running more than one server. */
  SCHEDULER_ENABLED: process.env.SCHEDULER_ENABLED !== 'false',
  STORAGE_TYPE: process.env.STORAGE_TYPE || 'local',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '2525', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'IT Asset Management <noreply@itam.local>',
};
