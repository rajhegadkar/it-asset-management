import { prisma } from '../config/db.js';

export class DepartmentLocationVendorService {
  // --- Organization ---
  static async getOrganization() {
    return await prisma.organization.findFirst();
  }

  static async updateOrganization(data: {
    name?: string;
    logoUrl?: string;
    address?: string;
    email?: string;
    phone?: string;
    website?: string;
    taxId?: string;
    currency?: string;
  }) {
    const org = await prisma.organization.findFirst();
    if (!org) {
      return await prisma.organization.create({
        data: {
          name: data.name || 'Acme Global Technologies Inc.',
          slug: 'organization-master',
          ...data,
        },
      });
    }
    return await prisma.organization.update({
      where: { id: org.id },
      data,
    });
  }

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

  static async updateDepartment(id: string, data: Partial<{ name: string; code: string; departmentHead: string; locationId: string; costCenter: string }>) {
    return await prisma.department.update({
      where: { id },
      data,
    });
  }

  static async deleteDepartment(id: string) {
    return await prisma.department.delete({
      where: { id },
    });
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

  static async updateLocation(id: string, data: Partial<{ name: string; code: string; type: string; parentId: string; address: string }>) {
    return await prisma.location.update({
      where: { id },
      data,
    });
  }

  static async deleteLocation(id: string) {
    return await prisma.location.delete({
      where: { id },
    });
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

  static async updateVendor(id: string, data: Partial<{
    name: string;
    code: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    website: string;
    taxId: string;
    paymentTerms: string;
  }>) {
    return await prisma.vendor.update({
      where: { id },
      data,
    });
  }

  static async deleteVendor(id: string) {
    return await prisma.vendor.delete({
      where: { id },
    });
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

  static async updateCategory(id: string, data: Partial<{
    name: string;
    code: string;
    parentId: string;
    description: string;
    icon: string;
    customFieldsSchema: any;
  }>) {
    const updatePayload: any = { ...data };
    if (data.customFieldsSchema !== undefined) {
      updatePayload.customFieldsSchema = typeof data.customFieldsSchema === 'object'
        ? JSON.stringify(data.customFieldsSchema)
        : data.customFieldsSchema;
    }
    return await prisma.category.update({
      where: { id },
      data: updatePayload,
    });
  }

  static async deleteCategory(id: string) {
    return await prisma.category.delete({
      where: { id },
    });
  }
}
