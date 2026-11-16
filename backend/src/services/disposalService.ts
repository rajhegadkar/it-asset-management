import { prisma } from '../config/db.js';
import { z } from 'zod';

export const disposeSchema = z.object({
  assetId: z.string().min(1),
  disposalReason: z.string().min(1, 'Disposal reason is required').max(1000),
  disposalMethod: z.enum(['E_WASTE_RECYCLER', 'DONATION', 'BUYBACK_TRADEIN', 'SCRAP', 'SOLD']),
  disposalValue: z.union([z.number(), z.string()]).optional().nullable().transform((v) => (v === '' || v == null ? 0 : Number(v))),
  disposalApprovedBy: z.string().min(1, 'Approver is required').max(200),
  notes: z.string().max(2000).optional().nullable(),
});

export type DisposeAssetInput = z.input<typeof disposeSchema>;

export class DisposalService {
  /**
   * Process permanent and auditable asset disposal
   */
  static async dispose(rawInput: DisposeAssetInput, user?: any) {
    const input = disposeSchema.parse(rawInput);
    if (Number.isNaN(input.disposalValue) || input.disposalValue < 0) {
      throw { statusCode: 400, message: 'Disposal value must be a positive number.', code: 'VALIDATION_ERROR' };
    }

    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({ where: { id: input.assetId } });
      if (!asset) throw { statusCode: 404, message: 'Asset not found', code: 'ASSET_NOT_FOUND' };

      if (asset.currentEmployeeId || asset.status === 'ASSIGNED') {
        throw { statusCode: 400, message: 'Cannot dispose of an asset that is currently assigned to an employee. Return the asset first.', code: 'ASSET_CURRENTLY_ASSIGNED' };
      }
      if (asset.status === 'DISPOSED') {
        throw { statusCode: 400, message: 'This asset is already marked as disposed.', code: 'ALREADY_DISPOSED' };
      }
      const openMaintenance = await tx.maintenanceRecord.count({ where: { assetId: asset.id, endDate: null } });
      if (openMaintenance > 0) {
        throw { statusCode: 400, message: 'Close the open maintenance record before disposing of this asset.', code: 'OPEN_MAINTENANCE' };
      }

      // Release any software seats still tied to the device
      const seats = await tx.licenseAssignment.findMany({ where: { assetId: asset.id } });
      for (const seat of seats) {
        await tx.licenseAssignment.delete({ where: { id: seat.id } });
        await tx.softwareLicense.update({ where: { id: seat.licenseId }, data: { quantityUsed: { decrement: 1 } } });
      }

      const updated = await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: 'DISPOSED',
          disposalDate: new Date(),
          disposalReason: input.disposalReason,
          disposalMethod: input.disposalMethod,
          disposalValue: input.disposalValue,
          disposalApprovedBy: input.disposalApprovedBy,
          isArchived: true,
        },
      });

      await tx.assetLifecycleLog.create({
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
            licenseSeatsReleased: seats.length,
          }),
        },
      });

      return updated;
    });
  }
}
