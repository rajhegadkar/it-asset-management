import { prisma } from '../config/db.js';

export class DepartmentLocationVendorService {
  // --- Departments ---
  static async getDepartments() {
    return await prisma.department.findMany({
      include: {
        location: true,
        _count: { select: { employees: true, assets: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async createDepartment(data: { name: string; code: string; departmentHead?: string; locationId?: string; costCenter?: string }) {
    return await prisma.department.create({ data });
  }

  // --- Locations (Hierarchical) ---
  static async getLocations() {
    return await prisma.location.findMany({
      include: {
        parent: true,
        children: true,
        _count: { select: { assets: true, employees: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async createLocation(data: { name: string; code: string; type?: string; parentId?: string; address?: string }) {
    return await prisma.location.create({ data });
  }

  // --- Vendors ---
  static async getVendors() {
    return await prisma.vendor.findMany({
      include: {
        _count: { select: { assets: true, licenses: true, maintenance: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async createVendor(data: {
    name: string;
    code: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    taxId?: string;
    paymentTerms?: string;
  }) {
    return await prisma.vendor.create({ data });
  }

  // --- Categories ---
  static async getCategories() {
    return await prisma.category.findMany({
      include: {
        subcategories: true,
        _count: { select: { assets: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async createCategory(data: {
    name: string;
    code: string;
    parentId?: string;
    description?: string;
    icon?: string;
    customFieldsSchema?: any;
  }) {
    return await prisma.category.create({
      data: {
        name: data.name,
        code: data.code,
        parentId: data.parentId,
        description: data.description,
        icon: data.icon,
        customFieldsSchema: data.customFieldsSchema ? JSON.stringify(data.customFieldsSchema) : null,
      },
    });
  }
}
