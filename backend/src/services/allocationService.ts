import { prisma } from '../config/db.js';
import { PdfService } from '../utils/pdfService.js';
import { EmailService } from '../utils/emailService.js';

export interface AllocateAssetInput {
  assetId: string;
  employeeId: string;
  allocationType: 'PERMANENT' | 'TEMPORARY' | 'PROJECT' | 'LOANER' | 'REMOTE_WORK' | 'REPLACEMENT';
  expectedReturnDate?: string;
  accessories?: string[] | string;
  notes?: string;
}

export class AllocationService {
  /**
   * Allocate asset to employee with verification, handover generation & notification
   */
  static async allocate(input: AllocateAssetInput, user?: any) {
    const asset = await prisma.asset.findUnique({
      where: { id: input.assetId },
      include: { category: true, organization: true },
    });

    if (!asset) {
      throw { statusCode: 404, message: 'Asset not found', code: 'ASSET_NOT_FOUND' };
    }

    if (asset.isArchived || asset.status === 'RETIRED' || asset.status === 'DISPOSED') {
      throw {
        statusCode: 400,
        message: `Asset cannot be allocated because it is ${asset.status}.`,
        code: 'ASSET_INACTIVE',
      };
    }

    if (asset.status === 'ASSIGNED' || asset.currentEmployeeId) {
      throw {
        statusCode: 400,
        message: 'Asset cannot be allocated because it is already assigned to another employee.',
        code: 'ASSET_ALREADY_ASSIGNED',
      };
    }

    if (asset.status === 'UNDER_MAINTENANCE' || asset.status === 'REPAIR') {
      throw {
        statusCode: 400,
        message: 'Asset is currently undergoing maintenance/repair and cannot be allocated.',
        code: 'ASSET_UNDER_MAINTENANCE',
      };
    }

    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { department: true, user: true },
    });

    if (!employee) {
      throw { statusCode: 404, message: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' };
    }

    // Create Assignment Record
    const assignment = await prisma.assetAssignment.create({
      data: {
        assetId: asset.id,
        employeeId: employee.id,
        allocatedById: user?.id || 'system',
        allocationType: input.allocationType || 'PERMANENT',
        allocationDate: new Date(),
        expectedReturnDate: input.expectedReturnDate ? new Date(input.expectedReturnDate) : null,
        accessories: input.accessories ? JSON.stringify(input.accessories) : JSON.stringify([]),
        termsAccepted: false,
        status: 'ACTIVE',
        notes: input.notes,
      },
    });

    // Update Asset Status and Current Holder
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: 'ASSIGNED',
        currentEmployeeId: employee.id,
        assignmentDate: new Date(),
        expectedReturnDate: input.expectedReturnDate ? new Date(input.expectedReturnDate) : null,
        allocationType: input.allocationType,
        handoverStatus: 'PENDING_ACKNOWLEDGEMENT',
        departmentId: employee.departmentId || asset.departmentId,
      },
    });

    // Immutable Lifecycle Log
    await prisma.assetLifecycleLog.create({
      data: {
        assetId: asset.id,
        eventType: 'ALLOCATION',
        description: `Allocated to ${employee.firstName} ${employee.lastName} (${employee.employeeId}) as ${input.allocationType}`,
        fromStatus: asset.status,
        toStatus: 'ASSIGNED',
        performedById: user?.id,
        performedBy: user ? `${user.firstName || user.username}` : 'System',
        metadata: JSON.stringify({
          employee: `${employee.firstName} ${employee.lastName}`,
          employeeId: employee.employeeId,
          accessories: input.accessories || [],
        }),
      },
    });

    // Create In-App Notification for Employee if linked to User
    if (employee.userId) {
      await prisma.notification.create({
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

    // Send Handover Email
    if (employee.email) {
      const accText = Array.isArray(input.accessories)
        ? input.accessories.join(', ')
        : (typeof input.accessories === 'string' && input.accessories.trim() ? input.accessories : 'Standard unit');

      const emailHtml = EmailService.wrapTemplate(
        'IT Asset Allocation Notification',
        `
          <p>Dear <strong>${employee.firstName} ${employee.lastName}</strong>,</p>
          <p>The following IT equipment has been assigned to you by IT Operations:</p>
          <ul>
            <li><strong>Asset Name:</strong> ${asset.name}</li>
            <li><strong>Asset ID:</strong> ${asset.assetId}</li>
            <li><strong>Asset Tag:</strong> ${asset.assetTag}</li>
            <li><strong>Serial Number:</strong> ${asset.serialNumber}</li>
            <li><strong>Allocation Type:</strong> ${input.allocationType}</li>
            <li><strong>Accessories:</strong> ${accText}</li>
          </ul>
          <p>Please log in to your employee self-service portal to acknowledge custody of this asset.</p>
        `,
        asset.organization?.name
      );

      await EmailService.sendMail({
        to: employee.email,
        subject: `IT Equipment Assigned: ${asset.name} (${asset.assetId})`,
        html: emailHtml,
      });
    }

    return {
      assignment,
      assetId: asset.assetId,
      message: 'Asset successfully allocated and handover initiated.',
    };
  }

  /**
   * Digital Acknowledgement & Electronic Signature
   */
  static async acknowledge(assignmentId: string, params: { signatureData?: string; ipAddress?: string; user?: any }) {
    const assignment = await prisma.assetAssignment.findUnique({
      where: { id: assignmentId },
      include: { asset: true, employee: true },
    });

    if (!assignment) {
      throw { statusCode: 404, message: 'Assignment record not found', code: 'ASSIGNMENT_NOT_FOUND' };
    }

    const updated = await prisma.assetAssignment.update({
      where: { id: assignmentId },
      data: {
        termsAccepted: true,
        acknowledgedAt: new Date(),
        acknowledgementType: 'DIGITAL_SIGNATURE',
        acknowledgementIp: params.ipAddress,
        signatureData: params.signatureData || `${assignment.employee.firstName} ${assignment.employee.lastName}`,
      },
    });

    await prisma.asset.update({
      where: { id: assignment.assetId },
      data: { handoverStatus: 'ACKNOWLEDGED' },
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

    const accessories = assignment.accessories ? JSON.parse(assignment.accessories) : [];

    const org = await prisma.organization.findFirst();
    const brandingSetting = await prisma.systemSetting.findUnique({ where: { key: 'company.name' } });
    const currentCompanyName = brandingSetting?.value || org?.name || assignment.asset.organization?.name || 'IT Asset Management';

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
      allocatedBy: 'IT Department Representative',
      termsAccepted: assignment.termsAccepted,
      signatureData: assignment.signatureData || undefined,
      acknowledgedAt: assignment.acknowledgedAt?.toISOString().split('T')[0],
    });
  }
}
