import { prisma } from '../config/db.js';

/** Copies only allow-listed keys; '' becomes null for optional links. */
function pick(data: any, keys: string[], nullable: string[] = []): any {
  const out: any = {};
  for (const k of keys) {
    if (data && data[k] !== undefined) out[k] = nullable.includes(k) && data[k] === '' ? null : data[k];
  }
  return out;
}

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
    contactEmail?: string;
    phone?: string;
    website?: string;
    taxId?: string;
    currency?: string;
  }) {
    const org = await prisma.organization.findFirst();
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.email !== undefined || data.contactEmail !== undefined) updateData.email = data.email || data.contactEmail;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.taxId !== undefined) updateData.taxId = data.taxId;
    if (data.currency !== undefined) updateData.currency = data.currency;

    if (!org) {
      return await prisma.organization.create({
        data: {
          name: updateData.name || 'Acme Global Technologies Inc.',
          slug: 'organization-master',
          ...updateData,
        },
      });
    }
    return await prisma.organization.update({
      where: { id: org.id },
      data: updateData,
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

  static async createDepartment(data: { name: string; code?: string; departmentHead?: string; locationId?: string; costCenter?: string }) {
    const code = data.code?.trim() || `DEP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return await prisma.department.create({
      data: {
        name: data.name,
        code,
        departmentHead: data.departmentHead,
        locationId: data.locationId,
        costCenter: data.costCenter,
      },
    });
  }

  static async updateDepartment(id: string, data: Partial<{ name: string; code: string; departmentHead: string; locationId: string; costCenter: string }>) {
    return await prisma.department.update({
      where: { id },
      data: pick(data, ['name', 'code', 'departmentHead', 'locationId', 'costCenter'], ['locationId']),
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

  static async createLocation(data: { name: string; code?: string; type?: string; parentId?: string; address?: string }) {
    const code = data.code?.trim() || `LOC-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return await prisma.location.create({
      data: {
        name: data.name,
        code,
        type: data.type || 'OFFICE',
        parentId: data.parentId,
        address: data.address,
      },
    });
  }

  static async updateLocation(id: string, data: Partial<{ name: string; code: string; type: string; parentId: string; address: string }>) {
    if (data?.parentId && data.parentId === id) throw { statusCode: 400, message: 'A location cannot be its own parent', code: 'VALIDATION_ERROR' };
    if (data?.parentId) {
      // prevent cycles: walk up from the new parent
      let cursor: string | null = data.parentId;
      for (let i = 0; cursor && i < 50; i++) {
        if (cursor === id) throw { statusCode: 400, message: 'That parent would create a loop in the location hierarchy', code: 'VALIDATION_ERROR' };
        const p: { parentId: string | null } | null = await prisma.location.findUnique({ where: { id: cursor }, select: { parentId: true } });
        cursor = p?.parentId || null;
      }
    }
    return await prisma.location.update({
      where: { id },
      data: pick(data, ['name', 'code', 'type', 'parentId', 'address'], ['parentId']),
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
    code?: string;
    contactPerson?: string;
    email?: string;
    contactEmail?: string;
    phone?: string;
    address?: string;
    website?: string;
    taxId?: string;
    paymentTerms?: string;
  }) {
    const code = data.code?.trim() || `VEN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return await prisma.vendor.create({
      data: {
        name: data.name,
        code,
        contactPerson: data.contactPerson,
        email: data.email || data.contactEmail,
        phone: data.phone,
        address: data.address,
        website: data.website,
        taxId: data.taxId,
        paymentTerms: data.paymentTerms,
      },
    });
  }

  static async updateVendor(id: string, data: Partial<{
    name: string;
    code: string;
    contactPerson: string;
    email: string;
    contactEmail: string;
    phone: string;
    address: string;
    website: string;
    taxId: string;
    paymentTerms: string;
  }>) {
    const updateData: any = pick(data, ['name', 'code', 'contactPerson', 'email', 'phone', 'address', 'website', 'taxId', 'paymentTerms']);
    if (data.contactEmail && !data.email) updateData.email = data.contactEmail;
    return await prisma.vendor.update({
      where: { id },
      data: updateData,
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
    code?: string;
    parentId?: string;
    description?: string;
    icon?: string;
    customFieldsSchema?: any;
  }) {
    const code = data.code?.trim() || `CAT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return await prisma.category.create({
      data: {
        name: data.name,
        code,
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
    const updatePayload: any = pick(data, ['name', 'code', 'parentId', 'description', 'icon', 'customFieldsSchema'], ['parentId']);
    if (data.parentId && data.parentId === id) throw { statusCode: 400, message: 'A category cannot be its own parent', code: 'VALIDATION_ERROR' };
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
