import { prisma } from '../config/db.js';

export interface DisposeAssetInput {
  assetId: string;
  disposalReason: string;
  disposalMethod: 'E_WASTE_RECYCLER' | 'DONATION' | 'BUYBACK_TRADEIN' | 'SCRAP' | 'SOLD';
  disposalValue?: number;
  disposalApprovedBy: string;
  notes?: string;
}

export class DisposalService {
  /**
   * Process permanent and auditable asset disposal
   */
  static async dispose(input: DisposeAssetInput, user?: any) {
    const asset = await prisma.asset.findUnique({
      where: { id: input.assetId },
    });

    if (!asset) {
      throw { statusCode: 404, message: 'Asset not found', code: 'ASSET_NOT_FOUND' };
    }

    if (asset.currentEmployeeId || asset.status === 'ASSIGNED') {
      throw {
        statusCode: 400,
        message: 'Cannot dispose of an asset that is currently assigned to an employee. Return the asset first.',
        code: 'ASSET_CURRENTLY_ASSIGNED',
      };
    }

    if (asset.status === 'DISPOSED') {
      throw {
        statusCode: 400,
        message: 'This asset is already marked as disposed.',
        code: 'ALREADY_DISPOSED',
      };
    }

    const updated = await prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: 'DISPOSED',
        disposalDate: new Date(),
        disposalReason: input.disposalReason,
        disposalMethod: input.disposalMethod,
        disposalValue: input.disposalValue || 0,
        disposalApprovedBy: input.disposalApprovedBy,
        isArchived: true,
      },
    });

    // Immutable Lifecycle log
    await prisma.assetLifecycleLog.create({
      data: {
        assetId: asset.id,
        eventType: 'DISPOSAL',
        description: `Permanently disposed via ${input.disposalMethod}. Reason: ${input.disposalReason}`,
        fromStatus: asset.status,
        toStatus: 'DISPOSED',
        performedById: user?.id,
        performedBy: user ? `${user.firstName || user.username}` : 'System',
        metadata: JSON.stringify({
          method: input.disposalMethod,
          reason: input.disposalReason,
          value: input.disposalValue,
          approvedBy: input.disposalApprovedBy,
        }),
      },
    });

    return updated;
  }
}
