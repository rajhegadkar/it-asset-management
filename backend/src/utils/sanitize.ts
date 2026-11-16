/**
 * Response hardening helpers.
 *
 * - SENSITIVE_KEYS are removed from every API response body (defence in depth:
 *   services also use SAFE_USER_SELECT so these fields are never loaded).
 * - escapeHtml() must wrap every user-controlled value placed into e-mail HTML.
 */
const SENSITIVE_KEYS = new Set([
  'passwordHash',
  'twoFactorSecret',
  'twoFactorRecoveryCodes',
  'tokenVersion',
  'failedLoginAttempts',
  'lockoutUntil',
]);

export function stripSensitive<T>(value: T, depth = 0): T {
  if (value === null || value === undefined || depth > 12) return value;
  if (Array.isArray(value)) return value.map((v) => stripSensitive(v, depth + 1)) as any;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (SENSITIVE_KEYS.has(k)) continue;
      out[k] = stripSensitive(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Prisma `select` for any User relation that is returned to the client. */
export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  roleId: true,
  isActive: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Removes secrets such as passwords from request bodies before they are written to the audit log. */
export function redactForAudit(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const clone: any = Array.isArray(body) ? [] : {};
  for (const [k, v] of Object.entries(body)) {
    if (/pass(word)?|secret|token|licenseKey|signatureData|bundleData|archiveData/i.test(k)) {
      clone[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      clone[k] = redactForAudit(v);
    } else {
      clone[k] = v;
    }
  }
  return clone;
}
