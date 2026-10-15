import { prisma } from '../config/db.js';

export interface CreateLicenseInput {
  softwareName: string;
  publisher: string;
  version?: string;
  licenseType: 'PER_USER' | 'PER_DEVICE' | 'SUBSCRIPTION' | 'PERPETUAL' | 'CONCURRENT' | 'ENTERPRISE';
  licenseKey?: string;
  purchaseDate?: string;
  expiryDate?: string;
  renewalDate?: string;
  quantityPurchased: number;
  cost?: number;
  vendorId?: string;
  contractNumber?: string;
  notes?: string;
}

export class LicenseService {
  static async getLicenses(params: { search?: string; type?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.type) where.licenseType = params.type;
    if (params.search && params.search.trim()) {
      where.OR = [
        { softwareName: { contains: params.search } },
        { publisher: { contains: params.search } },
      ];
    }

    const [total, licenses] = await Promise.all([
      prisma.softwareLicense.count({ where }),
      prisma.softwareLicense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: true,
          assignments: {
            include: { employee: true, asset: true },
          },
        },
      }),
    ]);

    return {
      licenses,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async createLicense(input: any) {
    const publisher = input.publisher?.trim() || 'Enterprise Software';
    const licenseType = input.licenseType || 'SUBSCRIPTION';
    const quantityPurchased = Number(input.quantityPurchased ?? input.totalSeats ?? 1) || 1;
    const cost = input.cost !== undefined ? Number(input.cost) : (input.costPerSeat ? Number(input.costPerSeat) : 0);

    return await prisma.softwareLicense.create({
      data: {
        softwareName: input.softwareName,
        publisher,
        version: input.version,
        licenseType,
        licenseKey: input.licenseKey,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        renewalDate: input.renewalDate ? new Date(input.renewalDate) : null,
        quantityPurchased,
        quantityUsed: 0,
        cost,
        vendorId: input.vendorId,
        contractNumber: input.contractNumber,
        notes: input.notes,
      },
    });
  }

  static async assignLicense(licenseId: string, params: { employeeId?: string; assetId?: string; notes?: string }) {
    const license = await prisma.softwareLicense.findUnique({
      where: { id: licenseId },
      include: { assignments: true },
    });

    if (!license) throw { statusCode: 404, message: 'License not found' };

    if (license.quantityUsed >= license.quantityPurchased) {
      throw {
        statusCode: 400,
        message: 'No available license seats remaining. Please purchase additional seats.',
        code: 'SEATS_EXHAUSTED',
      };
    }

    const assignment = await prisma.licenseAssignment.create({
      data: {
        licenseId,
        employeeId: params.employeeId,
        assetId: params.assetId,
        notes: params.notes,
      },
    });

    await prisma.softwareLicense.update({
      where: { id: licenseId },
      data: { quantityUsed: { increment: 1 } },
    });

    return assignment;
  }

  static async revokeLicense(assignmentId: string) {
    const assignment = await prisma.licenseAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw { statusCode: 404, message: 'Assignment not found' };

    await prisma.licenseAssignment.delete({ where: { id: assignmentId } });
    await prisma.softwareLicense.update({
      where: { id: assignment.licenseId },
      data: { quantityUsed: { decrement: 1 } },
    });

    return { message: 'License seat revoked successfully' };
  }

  static async getLicenseById(id: string) {
    const license = await prisma.softwareLicense.findUnique({
      where: { id },
      include: {
        vendor: true,
        assignments: {
          include: { employee: true, asset: true },
        },
      },
    });
    if (!license) throw { statusCode: 404, message: 'License not found' };
    return license;
  }

  static async updateLicense(id: string, input: Partial<CreateLicenseInput>) {
    const data: any = { ...input };
    if (input.purchaseDate !== undefined) data.purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : null;
    if (input.expiryDate !== undefined) data.expiryDate = input.expiryDate ? new Date(input.expiryDate) : null;
    if (input.renewalDate !== undefined) data.renewalDate = input.renewalDate ? new Date(input.renewalDate) : null;
    if (input.quantityPurchased !== undefined) data.quantityPurchased = Number(input.quantityPurchased);
    if (input.cost !== undefined) data.cost = input.cost ? Number(input.cost) : 0;

    return await prisma.softwareLicense.update({
      where: { id },
      data,
    });
  }

  static async deleteLicense(id: string) {
    await prisma.licenseAssignment.deleteMany({ where: { licenseId: id } });
    return await prisma.softwareLicense.delete({
      where: { id },
    });
  }
}
