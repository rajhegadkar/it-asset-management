import { prisma } from '../config/db.js';
import { sendTemplatedEmail } from './notificationTemplates.js';
import { z } from 'zod';

const CONDITIONS = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'] as const;
const RETURN_STATUSES = ['AVAILABLE', 'IN_STOCK', 'UNDER_MAINTENANCE', 'REPAIR', 'RETIRED'] as const;

export const returnSchema = z.object({
  assetId: z.string().min(1, 'assetId is required'),
  condition: z.enum(CONDITIONS).optional(),
  returnCondition: z.enum(CONDITIONS).optional(), // legacy field name still sent by some clients
  damageNotes: z.string().max(2000).optional().nullable(),
  accessoriesReturned: z.array(z.string().max(100)).max(30).optional().nullable(),
  missingAccessories: z.array(z.string().max(100)).max(30).optional().nullable(),
  newStatus: z.enum(RETURN_STATUSES).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type ReturnAssetInput = z.input<typeof returnSchema>;

export class ReturnService {
  /**
   * Process Asset Return Workflow (single transaction)
   */
  static async processReturn(rawInput: ReturnAssetInput, user?: any) {
    const input = returnSchema.parse(rawInput);
    const condition = input.condition || input.returnCondition || 'GOOD';
    let nextStatus: string = input.newStatus || 'AVAILABLE';
    if (condition === 'DAMAGED' && !input.newStatus) nextStatus = 'UNDER_MAINTENANCE';

    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: input.assetId },
        include: {
          currentEmployee: true,
          assignments: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } },
          organization: true,
        },
      });
      if (!asset) throw { statusCode: 404, message: 'Asset not found', code: 'ASSET_NOT_FOUND' };

      const activeAssignment = asset.assignments[0];
      const employeeId = asset.currentEmployeeId || activeAssignment?.employeeId;
      if (!employeeId) {
        throw { statusCode: 400, message: 'This asset is not currently assigned to any employee.', code: 'ASSET_NOT_ASSIGNED' };
      }
      const employee = asset.currentEmployee || (await tx.employee.findUnique({ where: { id: employeeId } }));

      const now = new Date();
      // Close every ACTIVE assignment for this asset (repairs any historic duplicates too)
      await tx.assetAssignment.updateMany({
        where: { assetId: asset.id, status: 'ACTIVE' },
        data: { status: 'RETURNED', returnedAt: now },
      });

      const returnRecord = await tx.assetReturn.create({
        data: {
          assetId: asset.id,
          assetAssignmentId: activeAssignment?.id || null,
          employeeId,
          returnedDate: now,
          receivedById: user?.id || 'system',
          condition,
          damageNotes: input.damageNotes || null,
          accessoriesReturned: input.accessoriesReturned ? JSON.stringify(input.accessoriesReturned) : null,
          missingAccessories: input.missingAccessories ? JSON.stringify(input.missingAccessories) : null,
          notes: input.notes || null,
        },
      });

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: nextStatus,
          condition,
          currentEmployeeId: null,
          assignmentDate: null,
          expectedReturnDate: null,
          handoverStatus: 'RETURNED',
          ...(nextStatus === 'RETIRED' ? { isArchived: true } : {}),
        },
      });

      await tx.assetLifecycleLog.create({
        data: {
          assetId: asset.id,
          eventType: 'RETURN',
          description: `Returned by ${employee ? `${employee.firstName} ${employee.lastName}` : 'Employee'} in condition: ${condition}. New status: ${nextStatus}.`,
          fromStatus: asset.status,
          toStatus: nextStatus,
          performedById: user?.id,
          performedBy: user ? `${user.firstName || user.username}` : 'System',
          metadata: JSON.stringify({ condition, damageNotes: input.damageNotes, missingAccessories: input.missingAccessories || [] }),
        },
      });

      return { returnRecord, asset, employee };
    });

    if (result.employee?.email) {
      await sendTemplatedEmail('ASSET_RETURNED', 'return', result.employee.email, {
        assetName: result.asset.name,
        assetTag: result.asset.assetTag,
        serialNumber: result.asset.serialNumber,
        employeeName: `${result.employee.firstName} ${result.employee.lastName}`,
        returnDate: new Date().toISOString().split('T')[0],
        condition,
        orgName: result.asset.organization?.name || '',
      });
    }

    return {
      returnRecord: result.returnRecord,
      assetId: result.asset.assetId,
      message: 'Asset successfully returned to inventory.',
    };
  }
}
