import { prisma } from '../config/db.js';
import { NumberingSchemeConfig } from './types.js';

export const DEFAULT_NUMBERING_SCHEMES: Record<string, NumberingSchemeConfig> = {
  ASSET_ID: {
    entity: 'ASSET_ID',
    prefix: 'IT',
    pattern: '{PREFIX}-{CAT}-{SEQ:6}',
    seqPadding: 6,
    currentSeq: 14,
    resetFrequency: 'NEVER',
    description: 'Hardware Inventory Master ID (e.g. IT-LAP-000015)',
  },
  ASSET_TAG: {
    entity: 'ASSET_TAG',
    prefix: 'TAG',
    pattern: '{PREFIX}-{CAT}-{SEQ:6}',
    seqPadding: 6,
    currentSeq: 14,
    resetFrequency: 'NEVER',
    description: 'Physical Barcode Asset Tag sticker (e.g. TAG-LAP-000015)',
  },
  TICKET: {
    entity: 'TICKET',
    prefix: 'TIK',
    pattern: '{PREFIX}-{SEQ:6}',
    seqPadding: 6,
    currentSeq: 10,
    resetFrequency: 'NEVER',
    description: 'Helpdesk Service Request number (e.g. TIK-000011)',
  },
  PO: {
    entity: 'PO',
    prefix: 'PO',
    pattern: '{PREFIX}-{YYYY}-{SEQ:4}',
    seqPadding: 4,
    currentSeq: 1,
    resetFrequency: 'YEARLY',
    description: 'Purchase Order Tracking Reference (e.g. PO-2026-0001)',
  },
};

export class NumberingEngine {
  private static getKey(entity: string): string {
    return `customization.numbering.${entity.toLowerCase()}`;
  }

  static async getScheme(entity: 'ASSET_ID' | 'ASSET_TAG' | 'TICKET' | 'PO'): Promise<NumberingSchemeConfig> {
    try {
      const key = this.getKey(entity);
      const setting = await prisma.systemSetting.findUnique({ where: { key } });
      if (setting && setting.value) {
        return JSON.parse(setting.value);
      }
    } catch (e) {
      console.warn(`Failed to fetch numbering scheme for ${entity}:`, e);
    }
    return DEFAULT_NUMBERING_SCHEMES[entity];
  }

  static async getAllSchemes(): Promise<Record<string, NumberingSchemeConfig>> {
    const entities: Array<'ASSET_ID' | 'ASSET_TAG' | 'TICKET' | 'PO'> = ['ASSET_ID', 'ASSET_TAG', 'TICKET', 'PO'];
    const result: Record<string, NumberingSchemeConfig> = {};
    for (const ent of entities) {
      result[ent] = await this.getScheme(ent);
    }
    return result;
  }

  static async updateScheme(entity: 'ASSET_ID' | 'ASSET_TAG' | 'TICKET' | 'PO', updates: Partial<NumberingSchemeConfig>): Promise<NumberingSchemeConfig> {
    const current = await this.getScheme(entity);
    const updated: NumberingSchemeConfig = {
      ...current,
      ...updates,
    };

    const key = this.getKey(entity);
    await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(updated),
        group: 'ASSET_NUMBERING',
      },
      create: {
        key,
        value: JSON.stringify(updated),
        group: 'ASSET_NUMBERING',
      },
    });

    // An admin changing the counter in the Customization Center moves the live sequence as well
    if (updates.currentSeq !== undefined && Number.isFinite(Number(updates.currentSeq))) {
      const seqKey = this.periodKey(entity, updated, new Date());
      await prisma.numberSequence.upsert({
        where: { key: seqKey },
        create: { key: seqKey, value: Number(updates.currentSeq) },
        update: { value: Number(updates.currentSeq) },
      });
    }

    return updated;
  }

  /**
   * Evaluates pattern string and replaces tokens with contextual values
   */
  static formatPattern(
    pattern: string,
    prefix: string,
    seq: number,
    seqPadding: number,
    context?: { categoryCode?: string; departmentCode?: string; date?: Date }
  ): string {
    const date = context?.date || new Date();
    const yyyy = date.getFullYear().toString();
    const yy = yyyy.substring(2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const cat = (context?.categoryCode || 'AST').toUpperCase().replace('CAT-', '').substring(0, 3);
    const dept = (context?.departmentCode || 'GEN').toUpperCase().substring(0, 3);

    let result = pattern;

    // Replace seq with requested padding: {SEQ:n} or fallback to seqPadding
    result = result.replace(/\{SEQ(?::(\d+))?\}/g, (_, padding) => {
      const p = padding ? parseInt(padding, 10) : seqPadding;
      return seq.toString().padStart(p, '0');
    });

    // Replace standard tokens
    result = result.replace(/\{PREFIX\}/g, prefix);
    result = result.replace(/\{YYYY\}/g, yyyy);
    result = result.replace(/\{YEAR\}/g, yyyy);
    result = result.replace(/\{YY\}/g, yy);
    result = result.replace(/\{MM\}/g, mm);
    result = result.replace(/\{YYYYMM\}/g, `${yyyy}${mm}`);
    result = result.replace(/\{CAT\}/g, cat);
    result = result.replace(/\{CATEGORY\}/g, cat);
    result = result.replace(/\{DEPT\}/g, dept);

    return result;
  }

  /** Counter key for the current reset period, e.g. "TICKET", "PO:2026", "ASSET_ID:2026-11". */
  private static periodKey(entity: string, scheme: NumberingSchemeConfig, now: Date): string {
    if (scheme.resetFrequency === 'YEARLY') return `${entity}:${now.getFullYear()}`;
    if (scheme.resetFrequency === 'MONTHLY') return `${entity}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return entity;
  }

  /**
   * Atomically reserves the next sequence value. A single UPDATE ... SET value = value + 1 means
   * two requests can never receive the same number, even under concurrent creates or bulk imports.
   */
  private static async nextValue(key: string, startAt: number): Promise<number> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const row = await prisma.numberSequence.upsert({
          where: { key },
          create: { key, value: startAt + 1 },
          update: { value: { increment: 1 } },
        });
        return row.value;
      } catch (e: any) {
        // Two first-ever calls raced on create: retry, the row now exists
        if (e?.code !== 'P2002' || attempt === 2) throw e;
      }
    }
    throw new Error('Unable to reserve sequence number');
  }

  /**
   * Generates next unique sequence number, increments database tracker
   */
  static async generateNext(
    entity: 'ASSET_ID' | 'ASSET_TAG' | 'TICKET' | 'PO',
    context?: { categoryCode?: string; departmentCode?: string }
  ): Promise<string> {
    const scheme = await this.getScheme(entity);
    const now = new Date();
    const key = this.periodKey(entity, scheme, now);
    // First use of a NEVER-reset counter continues from the number configured in the UI
    const startAt = scheme.resetFrequency === 'NEVER' ? Number(scheme.currentSeq) || 0 : 0;

    let generated = '';
    let seq = 0;
    for (let attempts = 0; attempts < 100; attempts++) {
      seq = await this.nextValue(key, startAt);
      generated = this.formatPattern(scheme.pattern, scheme.prefix, seq, scheme.seqPadding, { ...context, date: now });

      let exists = false;
      if (entity === 'ASSET_ID') {
        exists = !!(await prisma.asset.findFirst({ where: { assetId: generated }, select: { id: true } }));
      } else if (entity === 'ASSET_TAG') {
        exists = !!(await prisma.asset.findFirst({ where: { OR: [{ assetTag: generated }, { barcode: generated }] }, select: { id: true } }));
      } else if (entity === 'TICKET') {
        exists = !!(await prisma.ticket.findFirst({ where: { ticketNumber: generated }, select: { id: true } }));
      }
      if (!exists) break;
    }

    // Keep the scheme's display counter roughly in step (informational only; the sequence table is authoritative)
    try {
      const latest = await this.getScheme(entity);
      if ((latest.currentSeq || 0) < seq) {
        await this.saveSchemeOnly(entity, { ...latest, currentSeq: seq, lastResetYear: now.getFullYear(), lastResetMonth: now.getMonth() + 1 });
      }
    } catch {
      /* non-critical */
    }

    return generated;
  }

  private static async saveSchemeOnly(entity: string, scheme: NumberingSchemeConfig) {
    const key = this.getKey(entity);
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(scheme), group: 'ASSET_NUMBERING' },
      create: { key, value: JSON.stringify(scheme), group: 'ASSET_NUMBERING' },
    });
  }

  /**
   * Simulates generation without mutating sequence counter
   */
  static preview(
    pattern: string,
    prefix: string,
    seqPadding: number,
    sampleSeq: number = 42,
    context?: { categoryCode?: string; departmentCode?: string }
  ): string {
    return this.formatPattern(pattern, prefix, sampleSeq, seqPadding, {
      categoryCode: context?.categoryCode || 'LAP',
      departmentCode: context?.departmentCode || 'IT',
      date: new Date(),
    });
  }
}
