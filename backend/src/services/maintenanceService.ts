import { prisma } from '../config/db.js';
import { parseDate } from '../utils/dbCompat.js';
import { z } from 'zod';

const num = z.union([z.number(), z.string()]).optional().nullable().transform((v) => (v === '' || v == null ? undefined : Number(v)));

export const createMaintenanceSchema = z.object({
  assetId: z.string().min(1),
  maintenanceType: z.preprocess((v) => (typeof v === 'string' ? v.toUpperCase() : v), z.enum(['PREVENTIVE', 'CORRECTIVE', 'EMERGENCY'])),
  vendorId: z.string().optional().nullable(),
  engineerName: z.string().max(200).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  issue: z.string().min(1, 'Issue description is required').max(5000),
  diagnosis: z.string().max(5000).optional().nullable(),
  workPerformed: z.string().max(5000).optional().nullable(),
  partsReplaced: z.string().max(2000).optional().nullable(),
  cost: num,
  downtimeHours: num,
  warrantyCovered: z.boolean().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const completeMaintenanceSchema = z.object({
  endDate: z.string().optional().nullable(),
  workPerformed: z.string().max(5000).optional().nullable(),
  partsReplaced: z.string().max(2000).optional().nullable(),
  cost: num,
  downtimeHours: num,
  restoreStatus: z.enum(['AVAILABLE', 'IN_STOCK', 'ASSIGNED', 'RETIRED']).optional().nullable(),
});

export type CreateMaintenanceInput = z.input<typeof createMaintenanceSchema>;

function assertNonNegative(v: number | undefined, field: string) {
  if (v !== undefined && (Number.isNaN(v) || v < 0)) throw { statusCode: 400, message: `${field} must be a positive number`, code: 'VALIDATION_ERROR' };
}

export class MaintenanceService {
  static async getRecords(params: { assetId?: string; type?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.assetId) where.assetId = params.assetId;
    if (params.type) where.maintenanceType = params.type;

    const [total, records] = await Promise.all([
      prisma.maintenanceRecord.count({ where }),
      prisma.maintenanceRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
        include: { asset: true, vendor: true },
      }),
    ]);

    return { records, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async createRecord(rawInput: CreateMaintenanceInput, user?: any) {
    const input = createMaintenanceSchema.parse(rawInput);
    assertNonNegative(input.cost, 'Cost');
    assertNonNegative(input.downtimeHours, 'Downtime hours');
    const startDate = parseDate(input.startDate, 'startDate') || new Date();
    const endDate = parseDate(input.endDate, 'endDate');
    if (endDate && endDate < startDate) throw { statusCode: 400, message: 'End date cannot be before start date', code: 'VALIDATION_ERROR' };

    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({ where: { id: input.assetId } });
      if (!asset) throw { statusCode: 404, message: 'Asset not found' };
      if (asset.isArchived || asset.status === 'DISPOSED' || asset.status === 'RETIRED') {
        throw { statusCode: 400, message: 'Maintenance cannot be logged against a retired or disposed asset.', code: 'ASSET_INACTIVE' };
      }

      const record = await tx.maintenanceRecord.create({
        data: {
          assetId: input.assetId,
          maintenanceType: input.maintenanceType,
          vendorId: input.vendorId || null,
          engineerName: input.engineerName,
          startDate,
          endDate,
          issue: input.issue,
          diagnosis: input.diagnosis,
          workPerformed: input.workPerformed,
          partsReplaced: input.partsReplaced,
          cost: input.cost || 0,
          downtimeHours: input.downtimeHours || 0,
          warrantyCovered: input.warrantyCovered || false,
          notes: input.notes,
          organizationId: asset.organizationId,
        },
      });

      if (!endDate && asset.status !== 'UNDER_MAINTENANCE') {
        await tx.asset.update({ where: { id: asset.id }, data: { status: 'UNDER_MAINTENANCE' } });
        await tx.assetLifecycleLog.create({
          data: {
            assetId: asset.id,
            eventType: 'MAINTENANCE',
            description: `Asset placed under ${input.maintenanceType} maintenance: ${input.issue}`,
            fromStatus: asset.status,
            toStatus: 'UNDER_MAINTENANCE',
            performedById: user?.id,
            performedBy: user ? `${user.firstName || user.username}` : 'System',
          },
        });
      }

      return record;
    });
  }

  static async completeRecord(id: string, rawUpdates: z.input<typeof completeMaintenanceSchema>, user?: any) {
    const updates = completeMaintenanceSchema.parse(rawUpdates || {});
    assertNonNegative(updates.cost, 'Cost');
    assertNonNegative(updates.downtimeHours, 'Downtime hours');

    return prisma.$transaction(async (tx) => {
      const existing = await tx.maintenanceRecord.findUnique({ where: { id }, include: { asset: true } });
      if (!existing) throw { statusCode: 404, message: 'Maintenance record not found' };
      if (existing.endDate) throw { statusCode: 400, message: 'This maintenance record is already completed.', code: 'ALREADY_COMPLETED' };

      const endDate = parseDate(updates.endDate, 'endDate') || new Date();
      if (endDate < existing.startDate) throw { statusCode: 400, message: 'End date cannot be before start date', code: 'VALIDATION_ERROR' };

      const record = await tx.maintenanceRecord.update({
        where: { id },
        data: {
          endDate,
          workPerformed: updates.workPerformed || existing.workPerformed,
          partsReplaced: updates.partsReplaced || existing.partsReplaced,
          cost: updates.cost !== undefined ? updates.cost : existing.cost,
          downtimeHours: updates.downtimeHours !== undefined ? updates.downtimeHours : existing.downtimeHours,
        },
      });

      // Only release the asset when no other maintenance job is still open on it
      const stillOpen = await tx.maintenanceRecord.count({ where: { assetId: existing.assetId, endDate: null } });
      const asset = existing.asset;
      if (stillOpen === 0 && (asset.status === 'UNDER_MAINTENANCE' || asset.status === 'REPAIR')) {
        let targetStatus: string = updates.restoreStatus || (asset.currentEmployeeId ? 'ASSIGNED' : 'AVAILABLE');
        // Status must agree with custody
        if (targetStatus === 'ASSIGNED' && !asset.currentEmployeeId) targetStatus = 'AVAILABLE';
        if (asset.currentEmployeeId && targetStatus !== 'ASSIGNED') targetStatus = 'ASSIGNED';

        await tx.asset.update({
          where: { id: existing.assetId },
          data: { status: targetStatus, ...(targetStatus === 'RETIRED' ? { isArchived: true } : {}) },
        });
        await tx.assetLifecycleLog.create({
          data: {
            assetId: existing.assetId,
            eventType: 'MAINTENANCE',
            description: `Maintenance concluded. Work performed: ${updates.workPerformed || existing.workPerformed || 'Complete'}`,
            fromStatus: asset.status,
            toStatus: targetStatus,
            performedById: user?.id,
            performedBy: user ? `${user.firstName || user.username}` : 'System',
          },
        });
      }

      return record;
    });
  }
}
