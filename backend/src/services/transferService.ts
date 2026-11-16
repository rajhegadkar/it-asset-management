import { prisma } from '../config/db.js';
import { z } from 'zod';
import { INACTIVE_EMPLOYMENT } from './allocationService.js';

const optionalId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

export const transferSchema = z.object({
  assetId: z.string().min(1, 'assetId is required'),
  toEmployeeId: optionalId,
  toDepartmentId: optionalId,
  toLocationId: optionalId,
  reason: z.string().min(1, 'A transfer reason is required').max(1000),
  notes: z.string().max(2000).optional().nullable(),
});

export type TransferAssetInput = z.input<typeof transferSchema>;

export class TransferService {
  /**
   * Transfer asset between employees, departments, or locations.
   *
   * A custodian change closes the previous holder's assignment and opens a new one for the
   * receiving employee (pending their acknowledgement), so custody records always match the asset.
   */
  static async transfer(rawInput: TransferAssetInput, user?: any) {
    const input = transferSchema.parse(rawInput);
    if (!input.toEmployeeId && !input.toDepartmentId && !input.toLocationId) {
      throw { statusCode: 400, message: 'Choose a new employee, department or location for the transfer.', code: 'VALIDATION_ERROR' };
    }

    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: input.assetId },
        include: { currentEmployee: true },
      });
      if (!asset) throw { statusCode: 404, message: 'Asset not found', code: 'ASSET_NOT_FOUND' };
      if (asset.isArchived || asset.status === 'DISPOSED' || asset.status === 'RETIRED') {
        throw { statusCode: 400, message: 'Cannot transfer a retired or disposed asset', code: 'ASSET_INACTIVE' };
      }

      const custodianChange = !!input.toEmployeeId && input.toEmployeeId !== asset.currentEmployeeId;
      let toEmployee = null as null | { id: string; departmentId: string | null; firstName: string; lastName: string; employeeId: string; userId: string | null };
      if (custodianChange) {
        if (asset.status === 'UNDER_MAINTENANCE' || asset.status === 'REPAIR') {
          throw { statusCode: 400, message: 'Asset is under maintenance; complete the maintenance before handing it to someone else.', code: 'ASSET_UNDER_MAINTENANCE' };
        }
        const emp = await tx.employee.findUnique({ where: { id: input.toEmployeeId! } });
        if (!emp) throw { statusCode: 404, message: 'Receiving employee not found', code: 'EMPLOYEE_NOT_FOUND' };
        if (INACTIVE_EMPLOYMENT.includes((emp.employmentStatus || '').toUpperCase())) {
          throw { statusCode: 400, message: `Cannot transfer to an employee with status ${emp.employmentStatus}.`, code: 'EMPLOYEE_INACTIVE' };
        }
        toEmployee = emp;
      }

      const transferRecord = await tx.assetTransfer.create({
        data: {
          assetId: asset.id,
          fromEmployeeId: asset.currentEmployeeId,
          toEmployeeId: input.toEmployeeId || asset.currentEmployeeId,
          fromDepartmentId: asset.departmentId,
          toDepartmentId: input.toDepartmentId || toEmployee?.departmentId || asset.departmentId,
          fromLocationId: asset.locationId,
          toLocationId: input.toLocationId || asset.locationId,
          reason: input.reason,
          notes: input.notes || null,
          approvedById: user?.id,
        },
      });

      const updateData: any = {};
      if (input.toDepartmentId) updateData.departmentId = input.toDepartmentId;
      if (input.toLocationId) updateData.locationId = input.toLocationId;

      if (custodianChange && toEmployee) {
        const now = new Date();
        // Close the previous holder's custody record
        await tx.assetAssignment.updateMany({
          where: { assetId: asset.id, status: 'ACTIVE' },
          data: { status: 'TRANSFERRED', returnedAt: now },
        });
        // Open a new custody record for the receiver, pending their signature
        await tx.assetAssignment.create({
          data: {
            assetId: asset.id,
            employeeId: toEmployee.id,
            allocatedById: user?.id || 'system',
            allocationType: asset.allocationType || 'PERMANENT',
            allocationDate: now,
            accessories: JSON.stringify([]),
            termsAccepted: false,
            status: 'ACTIVE',
            notes: `Transferred from ${asset.currentEmployee ? `${asset.currentEmployee.firstName} ${asset.currentEmployee.lastName}` : 'inventory'}. Reason: ${input.reason}`,
          },
        });
        Object.assign(updateData, {
          currentEmployeeId: toEmployee.id,
          status: 'ASSIGNED',
          assignmentDate: now,
          handoverStatus: 'PENDING_ACKNOWLEDGEMENT',
          departmentId: input.toDepartmentId || toEmployee.departmentId || asset.departmentId,
        });
        if (toEmployee.userId) {
          await tx.notification.create({
            data: {
              userId: toEmployee.userId,
              organizationId: asset.organizationId,
              type: 'ASSET_ALLOCATED',
              title: 'IT Asset Transferred to You',
              message: `Asset ${asset.name} (${asset.assetId}) has been transferred to you. Please acknowledge receipt.`,
              link: '/portal/my-assets',
            },
          });
        }
      }

      if (Object.keys(updateData).length > 0) {
        await tx.asset.update({ where: { id: asset.id }, data: updateData });
      }

      await tx.assetLifecycleLog.create({
        data: {
          assetId: asset.id,
          eventType: 'TRANSFER',
          description: `Transferred${toEmployee ? ` to ${toEmployee.firstName} ${toEmployee.lastName} (${toEmployee.employeeId})` : ''}. Reason: ${input.reason}`,
          fromStatus: asset.status,
          toStatus: updateData.status || asset.status,
          performedById: user?.id,
          performedBy: user ? `${user.firstName || user.username}` : 'System',
          metadata: JSON.stringify({
            fromEmployee: asset.currentEmployeeId,
            toEmployee: input.toEmployeeId,
            fromDept: asset.departmentId,
            toDept: input.toDepartmentId,
            fromLocation: asset.locationId,
            toLocation: input.toLocationId,
            reason: input.reason,
          }),
        },
      });

      return transferRecord;
    });
  }
}
