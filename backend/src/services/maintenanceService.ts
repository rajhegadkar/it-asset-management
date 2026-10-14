import { prisma } from '../config/db.js';

export interface CreateMaintenanceInput {
  assetId: string;
  maintenanceType: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY';
  vendorId?: string;
  engineerName?: string;
  startDate: string;
  endDate?: string;
  issue: string;
  diagnosis?: string;
  workPerformed?: string;
  partsReplaced?: string;
  cost?: number;
  downtimeHours?: number;
  warrantyCovered?: boolean;
  notes?: string;
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
        include: {
          asset: true,
          vendor: true,
        },
      }),
    ]);

    return {
      records,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async createRecord(input: CreateMaintenanceInput, user?: any) {
    const asset = await prisma.asset.findUnique({ where: { id: input.assetId } });
    if (!asset) throw { statusCode: 404, message: 'Asset not found' };

    const record = await prisma.maintenanceRecord.create({
      data: {
        assetId: input.assetId,
        maintenanceType: input.maintenanceType,
        vendorId: input.vendorId,
        engineerName: input.engineerName,
        startDate: input.startDate ? new Date(input.startDate) : new Date(),
        endDate: input.endDate ? new Date(input.endDate) : null,
        issue: input.issue,
        diagnosis: input.diagnosis,
        workPerformed: input.workPerformed,
        partsReplaced: input.partsReplaced,
        cost: input.cost || 0,
        downtimeHours: input.downtimeHours || 0,
        warrantyCovered: input.warrantyCovered || false,
        notes: input.notes,
      },
    });

    // Update asset status to UNDER_MAINTENANCE if not completed
    if (!input.endDate) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: { status: 'UNDER_MAINTENANCE' },
      });

      await prisma.assetLifecycleLog.create({
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
  }

  static async completeRecord(id: string, updates: {
    endDate: string;
    workPerformed?: string;
    partsReplaced?: string;
    cost?: number;
    downtimeHours?: number;
    restoreStatus?: 'AVAILABLE' | 'IN_STOCK' | 'ASSIGNED';
  }, user?: any) {
    const existing = await prisma.maintenanceRecord.findUnique({ where: { id }, include: { asset: true } });
    if (!existing) throw { statusCode: 404, message: 'Maintenance record not found' };

    const record = await prisma.maintenanceRecord.update({
      where: { id },
      data: {
        endDate: updates.endDate ? new Date(updates.endDate) : new Date(),
        workPerformed: updates.workPerformed || existing.workPerformed,
        partsReplaced: updates.partsReplaced || existing.partsReplaced,
        cost: updates.cost !== undefined ? updates.cost : existing.cost,
        downtimeHours: updates.downtimeHours !== undefined ? updates.downtimeHours : existing.downtimeHours,
      },
    });

    // Restore asset status
    const targetStatus = updates.restoreStatus || (existing.asset.currentEmployeeId ? 'ASSIGNED' : 'AVAILABLE');
    await prisma.asset.update({
      where: { id: existing.assetId },
      data: { status: targetStatus },
    });

    await prisma.assetLifecycleLog.create({
      data: {
        assetId: existing.assetId,
        eventType: 'MAINTENANCE',
        description: `Maintenance concluded. Work performed: ${updates.workPerformed || 'Complete'}`,
        fromStatus: 'UNDER_MAINTENANCE',
        toStatus: targetStatus,
        performedById: user?.id,
        performedBy: user ? `${user.firstName || user.username}` : 'System',
      },
    });

    return record;
  }
}
