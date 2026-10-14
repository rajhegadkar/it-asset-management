import { prisma } from '../config/db.js';

export class ReportService {
  /**
   * Complete Asset Inventory Report
   */
  static async getInventoryReport(filters: {
    categoryId?: string;
    departmentId?: string;
    locationId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = { isArchived: false };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.purchaseDate = {};
      if (filters.startDate) where.purchaseDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.purchaseDate.lte = new Date(filters.endDate);
    }

    return await prisma.asset.findMany({
      where,
      include: {
        category: true,
        department: true,
        location: true,
        vendor: true,
        currentEmployee: true,
      },
      orderBy: { assetId: 'asc' },
    });
  }

  /**
   * Warranty & AMC Expiry Report
   */
  static async getWarrantyReport(daysAhead: number = 90) {
    const targetDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return await prisma.asset.findMany({
      where: {
        isArchived: false,
        warrantyEnd: {
          not: null,
          lte: targetDate,
        },
      },
      include: {
        category: true,
        department: true,
        currentEmployee: true,
        vendor: true,
      },
      orderBy: { warrantyEnd: 'asc' },
    });
  }

  /**
   * Allocations & Custody Report
   */
  static async getAllocationsReport() {
    return await prisma.assetAssignment.findMany({
      include: {
        asset: { include: { category: true } },
        employee: { include: { department: true, location: true } },
      },
      orderBy: { allocationDate: 'desc' },
    });
  }

  /**
   * Maintenance & Repair Cost Report
   */
  static async getMaintenanceReport() {
    return await prisma.maintenanceRecord.findMany({
      include: {
        asset: { include: { category: true } },
        vendor: true,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Software License Usage Report
   */
  static async getLicenseReport() {
    return await prisma.softwareLicense.findMany({
      include: {
        vendor: true,
        assignments: {
          include: { employee: true, asset: true },
        },
      },
      orderBy: { softwareName: 'asc' },
    });
  }

  /**
   * Consumables & Low Stock Report
   */
  static async getConsumablesReport() {
    return await prisma.consumable.findMany({
      include: { location: true, vendor: true },
      orderBy: { stockQuantity: 'asc' },
    });
  }

  /**
   * Disposed Assets Report
   */
  static async getDisposalReport() {
    return await prisma.asset.findMany({
      where: { status: 'DISPOSED' },
      include: { category: true, department: true },
      orderBy: { disposalDate: 'desc' },
    });
  }
}
