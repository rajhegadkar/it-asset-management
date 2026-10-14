import { prisma } from '../config/db.js';

export interface TransferAssetInput {
  assetId: string;
  toEmployeeId?: string;
  toDepartmentId?: string;
  toLocationId?: string;
  reason: string;
  notes?: string;
}

export class TransferService {
  /**
   * Transfer asset between employees, departments, or locations
   */
  static async transfer(input: TransferAssetInput, user?: any) {
    const asset = await prisma.asset.findUnique({
      where: { id: input.assetId },
      include: { currentEmployee: true, department: true, location: true },
    });

    if (!asset) {
      throw { statusCode: 404, message: 'Asset not found', code: 'ASSET_NOT_FOUND' };
    }

    if (asset.status === 'DISPOSED' || asset.status === 'RETIRED') {
      throw { statusCode: 400, message: 'Cannot transfer a retired or disposed asset', code: 'ASSET_INACTIVE' };
    }

    const previousEmployeeId = asset.currentEmployeeId;
    const previousDepartmentId = asset.departmentId;
    const previousLocationId = asset.locationId;

    // Create Transfer Record
    const transferRecord = await prisma.assetTransfer.create({
      data: {
        assetId: asset.id,
        fromEmployeeId: previousEmployeeId,
        toEmployeeId: input.toEmployeeId || previousEmployeeId,
        fromDepartmentId: previousDepartmentId,
        toDepartmentId: input.toDepartmentId || previousDepartmentId,
        fromLocationId: previousLocationId,
        toLocationId: input.toLocationId || previousLocationId,
        reason: input.reason,
        notes: input.notes,
        approvedById: user?.id,
      },
    });

    // Update Asset
    const updateData: any = {};
    if (input.toEmployeeId !== undefined) {
      updateData.currentEmployeeId = input.toEmployeeId;
      updateData.status = input.toEmployeeId ? 'ASSIGNED' : 'AVAILABLE';
      updateData.assignmentDate = input.toEmployeeId ? new Date() : null;
    }
    if (input.toDepartmentId !== undefined) updateData.departmentId = input.toDepartmentId;
    if (input.toLocationId !== undefined) updateData.locationId = input.toLocationId;

    await prisma.asset.update({
      where: { id: asset.id },
      data: updateData,
    });

    // Lifecycle Log
    await prisma.assetLifecycleLog.create({
      data: {
        assetId: asset.id,
        eventType: 'TRANSFER',
        description: `Transferred. Reason: ${input.reason}`,
        fromStatus: asset.status,
        toStatus: updateData.status || asset.status,
        performedById: user?.id,
        performedBy: user ? `${user.firstName || user.username}` : 'System',
        metadata: JSON.stringify({
          fromEmployee: previousEmployeeId,
          toEmployee: input.toEmployeeId,
          fromDept: previousDepartmentId,
          toDept: input.toDepartmentId,
          reason: input.reason,
        }),
      },
    });

    return transferRecord;
  }
}
