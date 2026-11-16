import { prisma } from '../config/db.js';
import { SAFE_USER_SELECT } from '../utils/sanitize.js';
import { ci, parseDate } from '../utils/dbCompat.js';
import { z } from 'zod';

const nullableId = z.string().optional().nullable().transform((v) => (v === '' ? null : v));
export const employeeSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required').max(50),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().max(100).optional().nullable().transform((v) => v ?? ''),
  email: z.string().email('A valid e-mail is required').max(200).transform((v) => v.trim().toLowerCase()),
  phone: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v == null ? v : String(v))),
  designation: z.string().max(200).optional().nullable(),
  departmentId: nullableId,
  locationId: nullableId,
  managerId: nullableId,
  joiningDate: z.string().optional().nullable(),
  employmentStatus: z.string().max(50).optional().nullable(),
  costCenter: z.string().max(100).optional().nullable(),
});

export interface CreateEmployeeInput {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  designation?: string;
  departmentId?: string;
  locationId?: string;
  managerId?: string;
  joiningDate?: string;
  employmentStatus?: string;
  costCenter?: string;
}

export class EmployeeService {
  static async getEmployees(params: {
    search?: string;
    departmentId?: string;
    locationId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.locationId) where.locationId = params.locationId;
    if (params.status) where.employmentStatus = params.status;

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { employeeId: ci(q) },
        { firstName: ci(q) },
        { lastName: ci(q) },
        { email: ci(q) },
        { designation: ci(q) },
      ];
    }

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { firstName: 'asc' },
        include: {
          department: true,
          location: true,
          manager: true,
          assets: {
            where: { isArchived: false },
            include: { category: true },
          },
        },
      }),
    ]);

    return {
      employees,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getEmployeeById(idOrEmpId: string) {
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [{ id: idOrEmpId }, { employeeId: idOrEmpId }, { email: idOrEmpId }],
      },
      include: {
        department: true,
        location: true,
        manager: true,
        subordinates: true,
        user: { select: SAFE_USER_SELECT },
        assets: {
          where: { isArchived: false },
          include: { category: true },
        },
        assignments: {
          orderBy: { allocationDate: 'desc' },
          include: { asset: true },
        },
        returns: {
          orderBy: { returnedDate: 'desc' },
          include: { asset: true },
        },
        ticketsRequested: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!employee) throw { statusCode: 404, message: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' };
    return employee;
  }

  static async createEmployee(raw: CreateEmployeeInput) {
    const input = employeeSchema.parse(raw);
    const existing = await prisma.employee.findFirst({
      where: { OR: [{ employeeId: input.employeeId }, { email: input.email }] },
    });
    if (existing) {
      throw {
        statusCode: 409,
        message: `Employee with ID "${input.employeeId}" or Email "${input.email}" already exists.`,
        code: 'DUPLICATE_EMPLOYEE',
      };
    }
    if (input.managerId) await this.assertManager(null, input.managerId);

    return await prisma.employee.create({
      data: {
        employeeId: input.employeeId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        designation: input.designation,
        departmentId: input.departmentId || null,
        locationId: input.locationId || null,
        managerId: input.managerId || null,
        joiningDate: parseDate(input.joiningDate, 'joiningDate'),
        employmentStatus: input.employmentStatus || 'ACTIVE',
        costCenter: input.costCenter,
      },
      include: { department: true, location: true },
    });
  }

  private static async assertManager(employeeId: string | null, managerId: string) {
    if (employeeId && managerId === employeeId) throw { statusCode: 400, message: 'An employee cannot be their own manager', code: 'VALIDATION_ERROR' };
    const mgr = await prisma.employee.findUnique({ where: { id: managerId } });
    if (!mgr) throw { statusCode: 400, message: 'Manager not found', code: 'VALIDATION_ERROR' };
  }

  static async updateEmployee(id: string, raw: Partial<CreateEmployeeInput>) {
    const input = employeeSchema.partial().parse(raw || {});
    const data: any = {};
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue;
      if (k === 'joiningDate') data.joiningDate = parseDate(v, 'joiningDate');
      else data[k] = v;
    }
    if (data.managerId) await this.assertManager(id, data.managerId);
    return await prisma.employee.update({
      where: { id },
      data,
      include: { department: true, location: true },
    });
  }

  /**
   * Deletes an employee with no history. Employees with assignments, returns, tickets or
   * license seats are deactivated instead, so custody and audit history stays intact.
   */
  static async deleteEmployee(id: string): Promise<{ deactivated: boolean }> {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        assets: { where: { isArchived: false } },
        _count: { select: { assignments: true, returns: true, ticketsRequested: true } },
      },
    });

    if (!employee) {
      throw { statusCode: 404, message: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' };
    }

    if (employee.assets.length > 0) {
      throw {
        statusCode: 400,
        message: `Cannot delete employee with ${employee.assets.length} active allocated assets. Please return or reallocate assets first.`,
        code: 'EMPLOYEE_HAS_ASSETS',
      };
    }

    const seats = await prisma.licenseAssignment.count({ where: { employeeId: id } });
    const hasHistory = employee._count.assignments + employee._count.returns + employee._count.ticketsRequested + seats > 0;
    if (hasHistory) {
      await prisma.employee.update({ where: { id }, data: { employmentStatus: 'TERMINATED' } });
      if (employee.userId) {
        await prisma.user.update({ where: { id: employee.userId }, data: { isActive: false, tokenVersion: { increment: 1 } } });
      }
      return { deactivated: true };
    }

    await prisma.employee.delete({ where: { id } });
    return { deactivated: false };
  }
}
