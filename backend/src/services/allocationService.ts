import { prisma } from '../config/db.js';
import { PdfService } from '../utils/pdfService.js';
import { parseDate } from '../utils/dbCompat.js';
import { WorkflowStatusEngine } from '../customization/workflowStatusEngine.js';
import { sendTemplatedEmail } from './notificationTemplates.js';
import { z } from 'zod';

export const ALLOCATION_TYPES = ['PERMANENT', 'TEMPORARY', 'PROJECT', 'LOANER', 'REMOTE_WORK', 'REPLACEMENT'] as const;
export const INACTIVE_EMPLOYMENT = ['TERMINATED', 'RESIGNED', 'EXITED', 'INACTIVE'];

export const allocateSchema = z.object({
  assetId: z.string().min(1, 'assetId is required'),
  employeeId: z.string().min(1, 'employeeId is required'),
  allocationType: z.enum(ALLOCATION_TYPES).optional().default('PERMANENT'),
  expectedReturnDate: z.string().optional().nullable(),
  accessories: z.union([z.array(z.string().max(100)).max(30), z.string().max(1000)]).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type AllocateAssetInput = z.input<typeof allocateSchema>;

/** Statuses from which an asset can be handed out (built-ins + custom statuses marked allowAllocation). */
export async function allocatableStatuses(): Promise<string[]> {
  const statuses = await WorkflowStatusEngine.getStatuses();
  const custom = statuses.filter((s) => s.allowAllocation && !s.isArchived).map((s) => s.code);
  return Array.from(new Set(['AVAILABLE', 'IN_STOCK', 'RETURNED', ...custom])).filter(
    (c) => !['ASSIGNED', 'IN_USE', 'DISPOSED', 'RETIRED', 'UNDER_MAINTENANCE', 'REPAIR', 'LOST', 'STOLEN'].includes(c)
  );
}

function actorName(user?: any) {
  return user ? `${user.firstName || user.username || 'User'}${user.lastName ? ' ' + user.lastName : ''}` : 'System';
}

export class AllocationService {
  /**
   * Allocate asset to employee. Runs in one transaction with a conditional update, so two
   * simultaneous allocations of the same asset cannot both succeed.
   */
  static async allocate(rawInput: AllocateAssetInput, user?: any) {
    const input = allocateSchema.parse(rawInput);
    const expectedReturnDate = parseDate(input.expectedReturnDate, 'expectedReturnDate');
    const allowedFrom = await allocatableStatuses();

    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: input.assetId },
        include: { category: true, organization: true },
      });
      if (!asset) throw { statusCode: 404, message: 'Asset not found', code: 'ASSET_NOT_FOUND' };

      if (asset.isArchived || asset.status === 'RETIRED' || asset.status === 'DISPOSED') {
        throw { statusCode: 400, message: `Asset cannot be allocated because it is ${asset.status}.`, code: 'ASSET_INACTIVE' };
      }
      if (asset.currentEmployeeId || asset.status === 'ASSIGNED' || asset.status === 'IN_USE') {
        throw { statusCode: 400, message: 'Asset cannot be allocated because it is already assigned to another employee.', code: 'ASSET_ALREADY_ASSIGNED' };
      }
      if (asset.status === 'UNDER_MAINTENANCE' || asset.status === 'REPAIR') {
        throw { statusCode: 400, message: 'Asset is currently undergoing maintenance/repair and cannot be allocated.', code: 'ASSET_UNDER_MAINTENANCE' };
      }
      if (!allowedFrom.includes(asset.status)) {
        throw { statusCode: 400, message: `Assets in status ${asset.status} cannot be allocated.`, code: 'STATUS_NOT_ALLOCATABLE' };
      }

      const employee = await tx.employee.findUnique({ where: { id: input.employeeId }, include: { department: true } });
      if (!employee) throw { statusCode: 404, message: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' };
      if (INACTIVE_EMPLOYMENT.includes((employee.employmentStatus || '').toUpperCase())) {
        throw { statusCode: 400, message: `Cannot allocate to an employee with status ${employee.employmentStatus}.`, code: 'EMPLOYEE_INACTIVE' };
      }

      // Conditional update = optimistic lock: only succeeds if nobody grabbed the asset meanwhile
      const claimed = await tx.asset.updateMany({
        where: { id: asset.id, currentEmployeeId: null, status: asset.status },
        data: {
          status: 'ASSIGNED',
          currentEmployeeId: employee.id,
          assignmentDate: new Date(),
          expectedReturnDate,
          allocationType: input.allocationType,
          handoverStatus: 'PENDING_ACKNOWLEDGEMENT',
          departmentId: employee.departmentId || asset.departmentId,
        },
      });
      if (claimed.count !== 1) {
        throw { statusCode: 409, message: 'Asset was allocated by someone else a moment ago. Refresh and try again.', code: 'ASSET_ALREADY_ASSIGNED' };
      }

      const accessoriesList = Array.isArray(input.accessories)
        ? input.accessories
        : typeof input.accessories === 'string' && input.accessories.trim()
          ? input.accessories.split(',').map((a) => a.trim()).filter(Boolean)
          : [];

      const assignment = await tx.assetAssignment.create({
        data: {
          assetId: asset.id,
          employeeId: employee.id,
          allocatedById: user?.id || 'system',
          allocationType: input.allocationType,
          allocationDate: new Date(),
          expectedReturnDate,
          accessories: JSON.stringify(accessoriesList),
          termsAccepted: false,
          status: 'ACTIVE',
          notes: input.notes || null,
        },
      });

      await tx.assetLifecycleLog.create({
        data: {
          assetId: asset.id,
          eventType: 'ALLOCATION',
          description: `Allocated to ${employee.firstName} ${employee.lastName} (${employee.employeeId}) as ${input.allocationType}`,
          fromStatus: asset.status,
          toStatus: 'ASSIGNED',
          performedById: user?.id,
          performedBy: actorName(user),
          metadata: JSON.stringify({ employee: `${employee.firstName} ${employee.lastName}`, employeeId: employee.employeeId, accessories: accessoriesList }),
        },
      });

      if (employee.userId) {
        await tx.notification.create({
          data: {
            userId: employee.userId,
            organizationId: asset.organizationId,
            type: 'ASSET_ALLOCATED',
            title: 'New IT Asset Assigned',
            message: `Asset ${asset.name} (${asset.assetId}) has been assigned to you. Please review and acknowledge receipt.`,
            link: `/portal/my-assets`,
          },
        });
      }

      return { assignment, asset, employee };
    });

    // E-mail after commit, so a mail failure never rolls back the allocation
    await sendTemplatedEmail('ASSET_ALLOCATED', 'allocation', result.employee.email, {
      assetName: result.asset.name,
      assetTag: result.asset.assetTag,
      assetId: result.asset.assetId,
      serialNumber: result.asset.serialNumber,
      employeeName: `${result.employee.firstName} ${result.employee.lastName}`,
      allocationDate: new Date().toISOString().split('T')[0],
      returnExpectedDate: expectedReturnDate ? expectedReturnDate.toISOString().split('T')[0] : 'Not set',
      orgName: result.asset.organization?.name || '',
    });

    return {
      assignment: result.assignment,
      assetId: result.asset.assetId,
      message: 'Asset successfully allocated and handover initiated.',
    };
  }

  /**
   * Digital Acknowledgement & Electronic Signature.
   * The employee signs for their own assignment; staff may record an in-person (witnessed) signature.
   */
  static async acknowledge(assignmentId: string, params: { signatureData?: string; ipAddress?: string; user?: any }) {
    const assignment = await prisma.assetAssignment.findUnique({
      where: { id: assignmentId },
      include: { asset: true, employee: true },
    });
    if (!assignment) throw { statusCode: 404, message: 'Assignment record not found', code: 'ASSIGNMENT_NOT_FOUND' };

    const u = params.user;
    const isOwner = !!u?.employeeId && u.employeeId === assignment.employeeId;
    const isStaffUser = !!u && ['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'].includes(u.roleName);
    if (!isOwner && !isStaffUser) {
      throw { statusCode: 403, message: 'You can only acknowledge assets assigned to you.', code: 'FORBIDDEN' };
    }
    if (assignment.status !== 'ACTIVE') {
      throw { statusCode: 400, message: `This assignment is ${assignment.status} and can no longer be acknowledged.`, code: 'ASSIGNMENT_CLOSED' };
    }
    if (assignment.termsAccepted) {
      throw { statusCode: 409, message: 'This assignment has already been acknowledged.', code: 'ALREADY_ACKNOWLEDGED' };
    }
    if (params.signatureData && params.signatureData.length > 500_000) {
      throw { statusCode: 400, message: 'Signature image is too large.', code: 'VALIDATION_ERROR' };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ack = await tx.assetAssignment.update({
        where: { id: assignmentId },
        data: {
          termsAccepted: true,
          acknowledgedAt: new Date(),
          acknowledgementType: isOwner ? 'DIGITAL_SIGNATURE' : 'IN_PERSON_WITNESSED',
          acknowledgementIp: params.ipAddress,
          signatureData: params.signatureData || `${assignment.employee.firstName} ${assignment.employee.lastName}`,
          notes: isOwner
            ? assignment.notes
            : `${assignment.notes ? assignment.notes + '\n' : ''}Signature captured in person, witnessed by ${actorName(u)}`,
        },
      });
      await tx.asset.update({ where: { id: assignment.assetId }, data: { handoverStatus: 'ACKNOWLEDGED' } });
      return ack;
    });

    return updated;
  }

  /**
   * Generate Downloadable Handover PDF
   */
  static async getHandoverPdf(assignmentId: string): Promise<Buffer> {
    const assignment = await prisma.assetAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        asset: { include: { category: true, organization: true } },
        employee: { include: { department: true } },
      },
    });

    if (!assignment) {
      throw { statusCode: 404, message: 'Assignment record not found', code: 'ASSIGNMENT_NOT_FOUND' };
    }

    let accessories: string[] = [];
    try {
      accessories = assignment.accessories ? JSON.parse(assignment.accessories) : [];
    } catch {
      accessories = [];
    }

    const org = await prisma.organization.findFirst();
    const brandingSetting = await prisma.systemSetting.findUnique({ where: { key: 'company.name' } });
    const currentCompanyName = brandingSetting?.value || org?.name || assignment.asset.organization?.name || 'IT Asset Management';

    let allocatedBy = 'IT Department Representative';
    if (assignment.allocatedById && assignment.allocatedById !== 'system') {
      const by = await prisma.user.findUnique({ where: { id: assignment.allocatedById }, select: { firstName: true, lastName: true } });
      if (by) allocatedBy = `${by.firstName} ${by.lastName}`;
    }

    return await PdfService.generateHandoverDocument({
      companyName: currentCompanyName,
      companyAddress: org?.address || assignment.asset.organization?.address || undefined,
      companyEmail: org?.email || assignment.asset.organization?.email || undefined,
      companyPhone: org?.phone || assignment.asset.organization?.phone || undefined,
      employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
      employeeId: assignment.employee.employeeId,
      employeeEmail: assignment.employee.email,
      departmentName: assignment.employee.department?.name || 'General',
      assetName: assignment.asset.name,
      assetId: assignment.asset.assetId,
      assetTag: assignment.asset.assetTag,
      serialNumber: assignment.asset.serialNumber,
      categoryName: assignment.asset.category.name,
      manufacturer: assignment.asset.manufacturer || undefined,
      model: assignment.asset.model || undefined,
      allocationDate: assignment.allocationDate.toISOString().split('T')[0],
      allocationType: assignment.allocationType,
      accessories,
      allocatedBy,
      termsAccepted: assignment.termsAccepted,
      signatureData: assignment.signatureData || undefined,
      acknowledgedAt: assignment.acknowledgedAt?.toISOString().split('T')[0],
    });
  }
}
