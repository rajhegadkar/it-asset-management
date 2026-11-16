import { prisma } from '../config/db.js';
import { SecretBox } from '../utils/secretBox.js';
import { ci, parseDate } from '../utils/dbCompat.js';
import { z } from 'zod';

const LICENSE_TYPES = ['PER_USER', 'PER_DEVICE', 'SUBSCRIPTION', 'PERPETUAL', 'CONCURRENT', 'ENTERPRISE'] as const;
const intLike = z.union([z.number(), z.string()]).optional().nullable().transform((v) => (v === '' || v == null ? undefined : Number(v)));

export const licenseSchema = z.object({
  softwareName: z.string().min(1, 'Software name is required').max(200),
  publisher: z.string().max(200).optional().nullable(),
  version: z.string().max(100).optional().nullable(),
  licenseType: z.enum(LICENSE_TYPES).optional().nullable(),
  licenseKey: z.string().max(5000).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  renewalDate: z.string().optional().nullable(),
  quantityPurchased: intLike,
  totalSeats: intLike,
  cost: intLike,
  costPerSeat: intLike,
  vendorId: z.string().optional().nullable(),
  contractNumber: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const assignLicenseSchema = z.object({
  employeeId: z.string().optional().nullable(),
  assetId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateLicenseInput = z.input<typeof licenseSchema>;

/**
 * License keys are encrypted at rest and only returned in full to SUPER_ADMIN / IT_ADMIN.
 */
function presentLicense<T extends { licenseKey?: string | null }>(lic: T, revealKey: boolean): T {
  if (!lic) return lic;
  const plain = SecretBox.decrypt(lic.licenseKey);
  return { ...lic, licenseKey: revealKey ? plain : SecretBox.mask(plain, 4) };
}

function validInt(v: number | undefined, field: string, min = 0) {
  if (v !== undefined && (!Number.isFinite(v) || v < min || !Number.isInteger(v))) {
    throw { statusCode: 400, message: `${field} must be a whole number of at least ${min}`, code: 'VALIDATION_ERROR' };
  }
}

export class LicenseService {
  static async getLicenses(params: { search?: string; type?: string; page?: number; limit?: number; revealKeys?: boolean }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.type) where.licenseType = params.type;
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [{ softwareName: ci(q) }, { publisher: ci(q) }];
    }

    const [total, licenses] = await Promise.all([
      prisma.softwareLicense.count({ where }),
      prisma.softwareLicense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { vendor: true, assignments: { include: { employee: true, asset: true } } },
      }),
    ]);

    return {
      licenses: licenses.map((l) => presentLicense(l, !!params.revealKeys)),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async createLicense(raw: CreateLicenseInput) {
    const input = licenseSchema.parse(raw);
    const quantityPurchased = input.quantityPurchased ?? input.totalSeats ?? 1;
    validInt(quantityPurchased, 'Seats purchased', 1);
    const cost = input.cost ?? input.costPerSeat ?? 0;
    if (!Number.isFinite(cost) || cost < 0) throw { statusCode: 400, message: 'Cost must be a positive number', code: 'VALIDATION_ERROR' };

    const created = await prisma.softwareLicense.create({
      data: {
        softwareName: input.softwareName,
        publisher: input.publisher?.trim() || 'Enterprise Software',
        version: input.version,
        licenseType: input.licenseType || 'SUBSCRIPTION',
        licenseKey: input.licenseKey ? SecretBox.encrypt(input.licenseKey) : null,
        purchaseDate: parseDate(input.purchaseDate, 'purchaseDate'),
        expiryDate: parseDate(input.expiryDate, 'expiryDate'),
        renewalDate: parseDate(input.renewalDate, 'renewalDate'),
        quantityPurchased,
        quantityUsed: 0,
        cost,
        vendorId: input.vendorId || null,
        contractNumber: input.contractNumber,
        notes: input.notes,
      },
    });
    return presentLicense(created, true);
  }

  static async assignLicense(licenseId: string, raw: z.input<typeof assignLicenseSchema>) {
    const params = assignLicenseSchema.parse(raw || {});
    if (!params.employeeId && !params.assetId) {
      throw { statusCode: 400, message: 'Choose an employee or a device to assign the seat to.', code: 'VALIDATION_ERROR' };
    }

    return prisma.$transaction(async (tx) => {
      const license = await tx.softwareLicense.findUnique({ where: { id: licenseId } });
      if (!license) throw { statusCode: 404, message: 'License not found' };
      if (license.expiryDate && license.expiryDate < new Date()) {
        throw { statusCode: 400, message: 'This license has expired. Renew it before assigning seats.', code: 'LICENSE_EXPIRED' };
      }

      const duplicate = await tx.licenseAssignment.findFirst({
        where: {
          licenseId,
          ...(params.employeeId ? { employeeId: params.employeeId } : {}),
          ...(params.assetId ? { assetId: params.assetId } : {}),
        },
      });
      if (duplicate) throw { statusCode: 409, message: 'A seat of this license is already assigned to that employee/device.', code: 'ALREADY_ASSIGNED' };

      // Atomic seat reservation: only increments if a seat is still free
      const reserved = await tx.softwareLicense.updateMany({
        where: { id: licenseId, quantityUsed: { lt: license.quantityPurchased } },
        data: { quantityUsed: { increment: 1 } },
      });
      if (reserved.count !== 1) {
        throw { statusCode: 400, message: 'No available license seats remaining. Please purchase additional seats.', code: 'SEATS_EXHAUSTED' };
      }

      return tx.licenseAssignment.create({
        data: { licenseId, employeeId: params.employeeId || null, assetId: params.assetId || null, notes: params.notes },
      });
    });
  }

  static async revokeLicense(assignmentId: string) {
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.licenseAssignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw { statusCode: 404, message: 'Assignment not found' };
      await tx.licenseAssignment.delete({ where: { id: assignmentId } });
      // Recount instead of decrementing so the counter can never drift below the real number
      const used = await tx.licenseAssignment.count({ where: { licenseId: assignment.licenseId } });
      await tx.softwareLicense.update({ where: { id: assignment.licenseId }, data: { quantityUsed: used } });
      return { message: 'License seat revoked successfully' };
    });
  }

  static async getLicenseById(id: string, revealKey = false) {
    const license = await prisma.softwareLicense.findUnique({
      where: { id },
      include: { vendor: true, assignments: { include: { employee: true, asset: true } } },
    });
    if (!license) throw { statusCode: 404, message: 'License not found' };
    return presentLicense(license, revealKey);
  }

  static async updateLicense(id: string, raw: Partial<CreateLicenseInput>) {
    const input = licenseSchema.partial().parse(raw || {});
    const existing = await prisma.softwareLicense.findUnique({ where: { id } });
    if (!existing) throw { statusCode: 404, message: 'License not found' };

    const data: any = {};
    for (const f of ['softwareName', 'publisher', 'version', 'licenseType', 'contractNumber', 'notes'] as const) {
      if (input[f] !== undefined && input[f] !== null) data[f] = input[f];
    }
    if (input.vendorId !== undefined) data.vendorId = input.vendorId || null;
    for (const f of ['purchaseDate', 'expiryDate', 'renewalDate'] as const) {
      if (input[f] !== undefined) data[f] = parseDate(input[f], f);
    }
    // A masked key coming back from the UI means "unchanged"
    if (input.licenseKey !== undefined && !SecretBox.isMasked(input.licenseKey)) {
      data.licenseKey = input.licenseKey ? SecretBox.encrypt(input.licenseKey) : null;
    }
    const seats = input.quantityPurchased ?? input.totalSeats;
    if (seats !== undefined) {
      validInt(seats, 'Seats purchased', 1);
      const used = await prisma.licenseAssignment.count({ where: { licenseId: id } });
      if (seats < used) {
        throw { statusCode: 400, message: `Cannot reduce seats to ${seats}: ${used} seats are currently assigned. Revoke seats first.`, code: 'SEATS_IN_USE' };
      }
      data.quantityPurchased = seats;
    }
    const cost = input.cost ?? input.costPerSeat;
    if (cost !== undefined) {
      if (!Number.isFinite(cost) || cost < 0) throw { statusCode: 400, message: 'Cost must be a positive number', code: 'VALIDATION_ERROR' };
      data.cost = cost;
    }

    const updated = await prisma.softwareLicense.update({ where: { id }, data });
    return presentLicense(updated, true);
  }

  static async deleteLicense(id: string) {
    const used = await prisma.licenseAssignment.count({ where: { licenseId: id } });
    if (used > 0) {
      throw { statusCode: 409, message: `This license still has ${used} assigned seat(s). Revoke them before deleting.`, code: 'RECORD_IN_USE' };
    }
    return await prisma.softwareLicense.delete({ where: { id } });
  }
}
