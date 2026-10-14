import { Request } from 'express';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

export interface AuditLogParams {
  organizationId?: string | null;
  userId?: string | null;
  username?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ALLOCATE' | 'RETURN' | 'TRANSFER' | 'DISPOSE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT' | 'SETTINGS_CHANGE';
  entity: string;
  entityId?: string | null;
  oldValues?: any;
  newValues?: any;
  req?: Request;
}

export async function logAuditEvent(params: AuditLogParams) {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    if (params.req) {
      ipAddress = (params.req.headers['x-forwarded-for'] as string) || params.req.socket.remoteAddress || null;
      userAgent = params.req.headers['user-agent'] || null;
    }

    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId || null,
        userId: params.userId || null,
        username: params.username || 'System',
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        oldValues: params.oldValues ? JSON.stringify(params.oldValues) : null,
        newValues: params.newValues ? JSON.stringify(params.newValues) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    logger.error('Failed to persist audit log entry:', error);
  }
}
