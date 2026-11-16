import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { redactForAudit } from '../utils/sanitize.js';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ALLOCATE'
  | 'ACKNOWLEDGE'
  | 'RETURN'
  | 'TRANSFER'
  | 'DISPOSE'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'SETTINGS_CHANGE'
  | 'SECURITY'
  | 'BACKUP'
  | 'RESTORE';

export interface AuditLogParams {
  organizationId?: string | null;
  userId?: string | null;
  username?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  oldValues?: any;
  newValues?: any;
  req?: Request;
}

// Serialise writes so each entry's prevHash is the hash of the entry before it.
let chain: Promise<void> = Promise.resolve();
let lastTs = 0;

function clientIp(req: Request): string | null {
  return (req.ip || req.socket?.remoteAddress || null) as string | null;
}

export function logAuditEvent(params: AuditLogParams): Promise<void> {
  const run = async () => {
    try {
      const ipAddress = params.req ? clientIp(params.req) : null;
      const userAgent = params.req ? (params.req.headers['user-agent'] as string) || null : null;
      const user = params.req?.user;

      const data = {
        organizationId: params.organizationId ?? user?.organizationId ?? null,
        userId: params.userId ?? user?.id ?? null,
        username: params.username ?? user?.username ?? 'System',
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        oldValues: params.oldValues ? JSON.stringify(redactForAudit(params.oldValues)).slice(0, 20000) : null,
        newValues: params.newValues ? JSON.stringify(redactForAudit(params.newValues)).slice(0, 20000) : null,
        ipAddress,
        userAgent,
      };

      const last = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { hash: true } });
      const prevHash = last?.hash || 'GENESIS';
      // Strictly increasing timestamps keep the chain order unambiguous.
      const now = Math.max(Date.now(), lastTs + 1);
      lastTs = now;
      const createdAt = new Date(now);
      const hash = crypto
        .createHash('sha256')
        .update(prevHash + JSON.stringify({ ...data, createdAt: createdAt.toISOString() }))
        .digest('hex');

      await prisma.auditLog.create({ data: { ...data, createdAt, prevHash, hash } });
    } catch (error) {
      logger.error('Failed to persist audit log entry:', error);
    }
  };
  chain = chain.then(run, run);
  return chain;
}

const METHOD_ACTION: Record<string, AuditAction> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

// Routes that write their own, more specific audit entries (or are noise).
const SKIP = [/^\/api\/v1\/auth\//, /\/notifications/, /\/preview$/, /\/test-cloud$/, /\/email\/test$/];

const ACTION_BY_PATH: Array<[RegExp, AuditAction, string]> = [
  [/\/allocations\/allocate/, 'ALLOCATE', 'Asset'],
  [/\/allocations\/acknowledge/, 'ACKNOWLEDGE', 'AssetAssignment'],
  [/\/allocations\/return/, 'RETURN', 'Asset'],
  [/\/allocations\/transfer/, 'TRANSFER', 'Asset'],
  [/\/allocations\/dispose/, 'DISPOSE', 'Asset'],
  [/\/imports\/upload/, 'IMPORT', 'Import'],
  [/\/system\/settings|\/system\/email-settings|\/customization\//, 'SETTINGS_CHANGE', 'Settings'],
  [/\/system\/backup\/restore/, 'RESTORE', 'Backup'],
  [/\/system\/backup/, 'BACKUP', 'Backup'],
];

/**
 * Records every successful write (POST/PUT/PATCH/DELETE) made by an authenticated user.
 * Mounted once in app.ts so no endpoint can be forgotten.
 */
export function auditTrail(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (!METHOD_ACTION[method] || SKIP.some((r) => r.test(req.originalUrl))) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.user) return;
    const path = req.originalUrl.split('?')[0];
    let action: AuditAction = METHOD_ACTION[method];
    let entity = path.replace(/^\/api\/v1\//, '').split('/')[0] || 'unknown';
    for (const [re, a, e] of ACTION_BY_PATH) {
      if (re.test(path)) {
        action = a;
        entity = e;
        break;
      }
    }
    const entityId =
      (req.params && (req.params.id || req.params.assignmentId)) ||
      req.body?.assetId ||
      path.split('/').filter(Boolean).find((seg) => /^[0-9a-f-]{36}$/i.test(seg)) ||
      null;
    void logAuditEvent({
      action,
      entity,
      entityId,
      newValues: { method, path, body: req.body },
      req,
    });
  });
  next();
}

/** Verifies the hash chain; returns the id of the first broken entry, if any. */
export async function verifyAuditChain(): Promise<{ valid: boolean; checked: number; brokenAt?: string }> {
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
  let prev = 'GENESIS';
  let checked = 0;
  for (const r of rows) {
    if (!r.hash) continue; // entries written before hashing existed
    const { id, hash, prevHash, createdAt, user, organization, ...rest } = r as any;
    const expected = crypto
      .createHash('sha256')
      .update(
        (prevHash || 'GENESIS') +
          JSON.stringify({
            organizationId: rest.organizationId,
            userId: rest.userId,
            username: rest.username,
            action: rest.action,
            entity: rest.entity,
            entityId: rest.entityId,
            oldValues: rest.oldValues,
            newValues: rest.newValues,
            ipAddress: rest.ipAddress,
            userAgent: rest.userAgent,
            createdAt: new Date(createdAt).toISOString(),
          })
      )
      .digest('hex');
    if (expected !== hash || (checked > 0 && prevHash !== prev)) {
      return { valid: false, checked, brokenAt: id };
    }
    prev = hash;
    checked++;
  }
  return { valid: true, checked };
}
