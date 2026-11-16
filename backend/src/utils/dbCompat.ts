import { env } from '../config/env.js';

const isPostgres = () => /^postgres(ql)?:/i.test(env.DATABASE_URL || '');

/**
 * Case-insensitive `contains` filter that behaves the same on SQLite and PostgreSQL.
 * SQLite LIKE is already case-insensitive for ASCII and Prisma rejects `mode` there.
 */
export function ci(q: string): any {
  return isPostgres() ? { contains: q, mode: 'insensitive' } : { contains: q };
}

/** Returns `field` if it is in the allow-list, otherwise the fallback (prevents 500s on bad sortBy). */
export function safeSort(field: string | undefined, allowed: string[], fallback: string): string {
  return field && allowed.includes(field) ? field : fallback;
}

export function safeOrder(order: string | undefined): 'asc' | 'desc' {
  return order === 'asc' ? 'asc' : 'desc';
}

/** Parses a date string; throws a 400 instead of storing "Invalid Date". */
export function parseDate(value: any, field: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    // Excel serial date (days since 1899-12-30)
    if (value > 20000 && value < 80000) return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) {
    throw { statusCode: 400, message: `Invalid date for "${field}": ${value}`, code: 'VALIDATION_ERROR' };
  }
  return d;
}
