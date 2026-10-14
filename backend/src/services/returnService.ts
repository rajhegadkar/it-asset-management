import { prisma } from '../config/db.js';
import { EmailService } from '../utils/emailService.js';

export interface ReturnAssetInput {
  assetId: string;
  condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED';
  damageNotes?: string;
  accessoriesReturned?: string[];
  missingAccessories?: string[];
  newStatus?: 'AVAILABLE' | 'IN_STOCK' | 'UNDER_MAINTENANCE' | 'REPAIR' | 'RETIRED';
  notes?: string;
}

export class ReturnService {
  /**
   * Process Asset Return Workflow
   */
  static async processReturn(input: ReturnAssetInput, user?: any) {
    const asset = await prisma.asset.findUnique({
      where: { id: input.assetId },
      include: {
        currentEmployee: true,
        assignments: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        organization: true,
      },
    });

    if (!asset) {
      throw { statusCode: 404, message: 'Asset not found', code: 'ASSET_NOT_FOUND' };
    }

    if (!asset.currentEmployeeId && asset.status !== 'ASSIGNED') {
      throw {
        statusCode: 400,
        message: 'This asset is not currently assigned to any employee.',
        code: 'ASSET_NOT_ASSIGNED',
      };
    }

    const employee = asset.currentEmployee;
    const activeAssignment = asset.assignments[0];

    // Close active assignment if exists
    if (activeAssignment) {
      await prisma.assetAssignment.update({
        where: { id: activeAssignment.id },
        data: {
          status: 'RETURNED',
        },
      });
    }

    // Determine target asset status
    let nextStatus = input.newStatus || 'AVAILABLE';
    if (input.condition === 'DAMAGED' && !input.newStatus) {
      nextStatus = 'UNDER_MAINTENANCE';
    }

    // Create Asset Return Record
    const returnRecord = await prisma.assetReturn.create({
      data: {
        assetId: asset.id,
        assetAssignmentId: activeAssignment?.id || null,
        employeeId: employee?.id || asset.currentEmployeeId!,
        returnedDate: new Date(),
        receivedById: user?.id || 'system',
        condition: input.condition,
        damageNotes: input.damageNotes,
        accessoriesReturned: input.accessoriesReturned ? JSON.stringify(input.accessoriesReturned) : null,
        missingAccessories: input.missingAccessories ? JSON.stringify(input.missingAccessories) : null,
        notes: input.notes,
      },
    });

    // Update Asset
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: nextStatus,
        condition: input.condition,
        currentEmployeeId: null,
        assignmentDate: null,
        expectedReturnDate: null,
        handoverStatus: 'RETURNED',
      },
    });

    // Lifecycle Log
    await prisma.assetLifecycleLog.create({
      data: {
        assetId: asset.id,
        eventType: 'RETURN',
        description: `Returned by ${employee ? `${employee.firstName} ${employee.lastName}` : 'Employee'} in condition: ${input.condition}. New status: ${nextStatus}.`,
        fromStatus: 'ASSIGNED',
        toStatus: nextStatus,
        performedById: user?.id,
        performedBy: user ? `${user.firstName || user.username}` : 'System',
        metadata: JSON.stringify({
          condition: input.condition,
          damageNotes: input.damageNotes,
          missingAccessories: input.missingAccessories || [],
        }),
      },
    });

    // Notify employee via email
    if (employee?.email) {
      const emailHtml = EmailService.wrapTemplate(
        'Asset Return Confirmation',
        `
          <p>Dear <strong>${employee.firstName} ${employee.lastName}</strong>,</p>
          <p>This email confirms that you have returned the following IT equipment:</p>
          <ul>
            <li><strong>Asset:</strong> ${asset.name} (${asset.assetId})</li>
            <li><strong>Return Date:</strong> ${new Date().toLocaleDateString()}</li>
            <li><strong>Assessed Condition:</strong> ${input.condition}</li>
            ${input.missingAccessories && input.missingAccessories.length > 0 ? `<li><strong>Missing Accessories:</strong> ${input.missingAccessories.join(', ')}</li>` : ''}
          </ul>
          <p>Your return receipt has been recorded in the enterprise ITAM registry.</p>
        `,
        asset.organization?.name
      );

      await EmailService.sendMail({
        to: employee.email,
        subject: `Asset Return Receipt: ${asset.name} (${asset.assetId})`,
        html: emailHtml,
      });
    }

    return {
      returnRecord,
      assetId: asset.assetId,
      message: 'Asset successfully returned to inventory.',
    };
  }
}
