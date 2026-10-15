import { prisma } from '../config/db.js';

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
        { employeeId: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
        { designation: { contains: q } },
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
        user: true,
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

  static async createEmployee(input: CreateEmployeeInput) {
    const existing = await prisma.employee.findFirst({
      where: {
        OR: [{ employeeId: input.employeeId }, { email: input.email }],
      },
    });

    if (existing) {
      throw {
        statusCode: 409,
        message: `Employee with ID "${input.employeeId}" or Email "${input.email}" already exists.`,
        code: 'DUPLICATE_EMPLOYEE',
      };
    }

    return await prisma.employee.create({
      data: {
        employeeId: input.employeeId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        designation: input.designation,
        departmentId: input.departmentId,
        locationId: input.locationId,
        managerId: input.managerId,
        joiningDate: input.joiningDate ? new Date(input.joiningDate) : null,
        employmentStatus: input.employmentStatus || 'ACTIVE',
        costCenter: input.costCenter,
      },
      include: { department: true, location: true },
    });
  }

  static async updateEmployee(id: string, input: Partial<CreateEmployeeInput>) {
    const data: any = { ...input };
    if (input.joiningDate) data.joiningDate = new Date(input.joiningDate);

    return await prisma.employee.update({
      where: { id },
      data,
      include: { department: true, location: true },
    });
  }

  static async deleteEmployee(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        assets: { where: { isArchived: false } },
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
    return await prisma.employee.delete({
      where: { id },
    });
  }
}
