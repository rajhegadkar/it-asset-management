import { prisma } from '../config/db.js';
import { BarcodeGenerator } from '../utils/barcodeGenerator.js';
import { PdfService } from '../utils/pdfService.js';
import { logAuditEvent } from '../middlewares/audit.js';

export interface CreateAssetInput {
  name: string;
  categoryId: string;
  subcategoryId?: string;
  serialNumber: string;
  assetTag?: string;
  customAssetId?: string;
  status?: string;
  condition?: string;
  departmentId?: string;
  locationId?: string;
  costCenter?: string;
  businessUnit?: string;
  floor?: string;
  room?: string;
  rack?: string;
  manufacturer?: string;
  brand?: string;
  model?: string;
  partNumber?: string;
  cpu?: string;
  cpuGeneration?: string;
  ram?: string;
  storage?: string;
  gpu?: string;
  operatingSystem?: string;
  osVersion?: string;
  macAddress?: string;
  ipAddress?: string;
  hostname?: string;
  managementIp?: string;
  vlan?: string;
  firmwareVersion?: string;
  portCount?: number;
  rackUnit?: string;
  datacenter?: string;
  vendorId?: string;
  poNumber?: string;
  invoiceNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  currency?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  warrantyProvider?: string;
  amcStart?: string;
  amcEnd?: string;
  contractNumber?: string;
  expectedLifeYears?: number;
  customFields?: Record<string, any>;
  notes?: string;
  description?: string;
}

import { NumberingEngine } from '../customization/numberingEngine.js';

export class AssetService {
  /**
   * Generates next sequential Asset ID based on category and customizable numbering rule
   */
  static async generateAssetId(categoryId: string): Promise<string> {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    const catCode = category ? category.code : 'AST';
    return await NumberingEngine.generateNext('ASSET_ID', { categoryCode: catCode });
  }

  /**
   * Generates next sequential Asset Tag based on category and customizable numbering rule
   */
  static async generateAssetTag(categoryId: string): Promise<string> {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    const catCode = category ? category.code : 'AST';
    return await NumberingEngine.generateNext('ASSET_TAG', { categoryCode: catCode });
  }

  /**
   * Search and List Assets with rich filtering & server-side pagination
   */
  static async getAssets(params: {
    search?: string;
    categoryId?: string;
    departmentId?: string;
    locationId?: string;
    status?: string;
    condition?: string;
    vendorId?: string;
    employeeId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      isArchived: false,
    };

    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.locationId) where.locationId = params.locationId;
    if (params.status) where.status = params.status;
    if (params.condition) where.condition = params.condition;
    if (params.vendorId) where.vendorId = params.vendorId;
    if (params.employeeId) where.currentEmployeeId = params.employeeId;

    if (params.search && params.search.trim() !== '') {
      const q = params.search.trim();
      where.OR = [
        { assetId: { contains: q } },
        { assetTag: { contains: q } },
        { serialNumber: { contains: q } },
        { name: { contains: q } },
        { manufacturer: { contains: q } },
        { model: { contains: q } },
        { hostname: { contains: q } },
        { ipAddress: { contains: q } },
        { macAddress: { contains: q } },
        {
          currentEmployee: {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { employeeId: { contains: q } },
              { email: { contains: q } },
            ],
          },
        },
      ];
    }

    const orderBy: any = {};
    const sortField = params.sortBy || 'createdAt';
    orderBy[sortField] = params.sortOrder || 'desc';

    const [total, assets] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: true,
          department: true,
          location: true,
          vendor: true,
          currentEmployee: true,
        },
      }),
    ]);

    return {
      assets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single Asset with complete relational details, history, tickets, maintenance
   */
  static async getAssetById(idOrAssetId: string) {
    const asset = await prisma.asset.findFirst({
      where: {
        OR: [
          { id: idOrAssetId },
          { assetId: idOrAssetId },
          { assetTag: idOrAssetId },
          { barcode: idOrAssetId },
          { serialNumber: idOrAssetId },
        ],
      },
      include: {
        category: true,
        department: true,
        location: true,
        vendor: true,
        currentEmployee: {
          include: {
            department: true,
            location: true,
          },
        },
        assignments: {
          orderBy: { createdAt: 'desc' },
          include: { employee: true },
        },
        returns: {
          orderBy: { createdAt: 'desc' },
          include: { employee: true },
        },
        transfers: {
          orderBy: { createdAt: 'desc' },
          include: {
            fromEmployee: true,
            toEmployee: true,
            fromDepartment: true,
            toDepartment: true,
            fromLocation: true,
            toLocation: true,
          },
        },
        lifecycleLogs: {
          orderBy: { createdAt: 'desc' },
        },
        maintenanceRecords: {
          orderBy: { createdAt: 'desc' },
          include: { vendor: true },
        },
        tickets: {
          orderBy: { createdAt: 'desc' },
          include: { requester: true, assignedEngineer: true },
        },
      },
    });

    if (!asset) {
      throw { statusCode: 404, message: 'Asset not found with the provided identifier', code: 'ASSET_NOT_FOUND' };
    }

    return asset;
  }

  /**
   * Create New Asset with Barcode & Lifecycle Record
   */
  static async createAsset(input: CreateAssetInput, user?: any) {
    const assetId = input.customAssetId || (await this.generateAssetId(input.categoryId));
    const assetTag = input.assetTag || (await this.generateAssetTag(input.categoryId));
    const barcode = assetTag;
    const qrCode = assetTag;

    // Check duplicate serial number or asset ID
    const existing = await prisma.asset.findFirst({
      where: {
        OR: [
          { assetId },
          { serialNumber: input.serialNumber },
          { assetTag },
        ],
      },
    });

    if (existing) {
      if (existing.serialNumber === input.serialNumber) {
        throw { statusCode: 409, message: `An asset with Serial Number "${input.serialNumber}" already exists.`, code: 'DUPLICATE_SERIAL' };
      }
      throw { statusCode: 409, message: `An asset with ID "${assetId}" or Tag "${assetTag}" already exists.`, code: 'DUPLICATE_ASSET_ID' };
    }

    const asset = await prisma.asset.create({
      data: {
        assetId,
        assetTag,
        barcode,
        qrCode,
        serialNumber: input.serialNumber,
        name: input.name,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        status: input.status || 'AVAILABLE',
        condition: input.condition || 'NEW',
        departmentId: input.departmentId,
        locationId: input.locationId,
        costCenter: input.costCenter,
        businessUnit: input.businessUnit,
        floor: input.floor,
        room: input.room,
        rack: input.rack,
        manufacturer: input.manufacturer,
        brand: input.brand,
        model: input.model,
        partNumber: input.partNumber,
        cpu: input.cpu,
        cpuGeneration: input.cpuGeneration,
        ram: input.ram,
        storage: input.storage,
        gpu: input.gpu,
        operatingSystem: input.operatingSystem,
        osVersion: input.osVersion,
        macAddress: input.macAddress,
        ipAddress: input.ipAddress,
        hostname: input.hostname,
        managementIp: input.managementIp,
        vlan: input.vlan,
        firmwareVersion: input.firmwareVersion,
        portCount: input.portCount ? Number(input.portCount) : null,
        rackUnit: input.rackUnit,
        datacenter: input.datacenter,
        vendorId: input.vendorId,
        poNumber: input.poNumber,
        invoiceNumber: input.invoiceNumber,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
        purchaseCost: input.purchaseCost ? Number(input.purchaseCost) : 0,
        currency: input.currency || 'USD',
        warrantyStart: input.warrantyStart ? new Date(input.warrantyStart) : null,
        warrantyEnd: input.warrantyEnd ? new Date(input.warrantyEnd) : null,
        warrantyProvider: input.warrantyProvider,
        amcStart: input.amcStart ? new Date(input.amcStart) : null,
        amcEnd: input.amcEnd ? new Date(input.amcEnd) : null,
        contractNumber: input.contractNumber,
        expectedLifeYears: input.expectedLifeYears ? Number(input.expectedLifeYears) : 3,
        customFields: input.customFields
          ? (typeof input.customFields === 'string' ? input.customFields : JSON.stringify(input.customFields))
          : null,
        notes: input.notes,
        description: input.description,
      },
      include: {
        category: true,
        department: true,
        location: true,
        vendor: true,
      },
    });

    // Record Immutable Lifecycle Log
    await prisma.assetLifecycleLog.create({
      data: {
        assetId: asset.id,
        eventType: 'PURCHASE',
        description: `Asset registered into inventory as ${asset.status}`,
        fromStatus: null,
        toStatus: asset.status,
        performedById: user?.id,
        performedBy: user ? `${user.firstName || user.username}` : 'System',
        metadata: JSON.stringify({ name: asset.name, serialNumber: asset.serialNumber }),
      },
    });

    return asset;
  }

  /**
   * Update Asset
   */
  static async updateAsset(id: string, input: Partial<CreateAssetInput>, user?: any) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw { statusCode: 404, message: 'Asset not found', code: 'ASSET_NOT_FOUND' };
    }

    const data: any = { ...input };
    if (input.purchaseDate) data.purchaseDate = new Date(input.purchaseDate);
    if (input.warrantyStart) data.warrantyStart = new Date(input.warrantyStart);
    if (input.warrantyEnd) data.warrantyEnd = new Date(input.warrantyEnd);
    if (input.amcStart) data.amcStart = new Date(input.amcStart);
    if (input.amcEnd) data.amcEnd = new Date(input.amcEnd);
    if (input.customFields !== undefined) {
      data.customFields = input.customFields
        ? (typeof input.customFields === 'string' ? input.customFields : JSON.stringify(input.customFields))
        : null;
    }
    if (input.portCount !== undefined) data.portCount = Number(input.portCount);
    if (input.purchaseCost !== undefined) data.purchaseCost = Number(input.purchaseCost);

    const updated = await prisma.asset.update({
      where: { id },
      data,
      include: {
        category: true,
        department: true,
        location: true,
        vendor: true,
        currentEmployee: true,
      },
    });

    // Log update lifecycle event
    await prisma.assetLifecycleLog.create({
      data: {
        assetId: id,
        eventType: 'UPDATE',
        description: `Asset specification and record updated`,
        fromStatus: existing.status,
        toStatus: updated.status,
        performedById: user?.id,
        performedBy: user ? `${user.firstName || user.username}` : 'System',
      },
    });

    return updated;
  }

  /**
   * Archive / Soft-delete Asset
   */
  static async archiveAsset(id: string, user?: any) {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw { statusCode: 404, message: 'Asset not found' };

    if (asset.currentEmployeeId || asset.status === 'ASSIGNED') {
      throw {
        statusCode: 400,
        message: 'Cannot archive an asset that is currently assigned to an employee. Return it first.',
        code: 'ASSET_CURRENTLY_ASSIGNED',
      };
    }

    const updated = await prisma.asset.update({
      where: { id },
      data: { isArchived: true, status: 'RETIRED' },
    });

    await prisma.assetLifecycleLog.create({
      data: {
        assetId: id,
        eventType: 'RETIREMENT',
        description: 'Asset retired and archived from active inventory',
        fromStatus: asset.status,
        toStatus: 'RETIRED',
        performedById: user?.id,
        performedBy: user ? `${user.firstName || user.username}` : 'System',
      },
    });

    return updated;
  }

  /**
   * Bulk generate printable labels PDF (complete inventory or specific required assets)
   */
  static async generateLabelsPdf(assetIds?: string[], all?: boolean, requestedStyle?: string): Promise<Buffer> {
    const isAll = all === true || (Array.isArray(assetIds) && assetIds.includes('all'));
    
    let assets;
    if (isAll || !assetIds || assetIds.length === 0) {
      assets = await prisma.asset.findMany({
        where: { isArchived: false },
        include: { 
          category: true, 
          organization: true,
          department: true,
          currentEmployee: true,
        },
        orderBy: { assetTag: 'asc' },
      });
    } else {
      assets = await prisma.asset.findMany({
        where: { 
          id: { in: assetIds },
          isArchived: false,
        },
        include: { 
          category: true, 
          organization: true,
          department: true,
          currentEmployee: true,
        },
        orderBy: { assetTag: 'asc' },
      });
    }

    if (assets.length === 0) {
      throw { statusCode: 404, message: 'No assets found for the specified criteria', code: 'ASSETS_NOT_FOUND' };
    }

    const org = await prisma.organization.findFirst();
    const brandingSetting = await prisma.systemSetting.findUnique({ where: { key: 'company.name' } });
    const currentCompanyName = brandingSetting?.value || org?.name || 'GLOBAL TECHNOLOGIES INC.';

    // Resolve sticker format from database setting or query/body parameter
    const styleSetting = await prisma.systemSetting.findUnique({ where: { key: 'barcode.sticker_style' } });
    const stickerStyle = (requestedStyle || styleSetting?.value || 'BOTH').toUpperCase();

    const labelData = assets.map((a) => {
      const userName = a.currentEmployee
        ? `${a.currentEmployee.firstName} ${a.currentEmployee.lastName}`.trim()
        : 'Unassigned (In Stock)';
      return {
        assetId: a.assetId,
        assetTag: a.assetTag,
        serialNumber: a.serialNumber || 'N/A',
        name: a.name || a.model || 'Hardware Asset',
        categoryName: a.category?.name || 'General',
        departmentName: a.department?.name || 'IT',
        userName,
        custodianName: userName,
        companyName: currentCompanyName,
      };
    });

    return await PdfService.generateAssetLabelSheet(labelData, stickerStyle);
  }

  /**
   * Dashboard Statistics
   */
  static async getDashboardMetrics() {
    const [
      totalAssets,
      assignedAssets,
      availableAssets,
      maintenanceAssets,
      disposedAssets,
      byCategory,
      byDepartment,
      byStatus,
      expiringWarrantyCount,
      openTicketsCount,
      criticalTicketsCount,
      lowStockConsumables,
      recentAllocations,
    ] = await Promise.all([
      prisma.asset.count({ where: { isArchived: false } }),
      prisma.asset.count({ where: { isArchived: false, status: 'ASSIGNED' } }),
      prisma.asset.count({ where: { isArchived: false, status: 'AVAILABLE' } }),
      prisma.asset.count({ where: { isArchived: false, status: 'UNDER_MAINTENANCE' } }),
      prisma.asset.count({ where: { status: 'DISPOSED' } }),
      prisma.asset.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        where: { isArchived: false },
      }),
      prisma.asset.groupBy({
        by: ['departmentId'],
        _count: { id: true },
        where: { isArchived: false, departmentId: { not: null } },
      }),
      prisma.asset.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { isArchived: false },
      }),
      // Warranty expiring in 90 days
      prisma.asset.count({
        where: {
          isArchived: false,
          warrantyEnd: {
            gte: new Date(),
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.ticket.count({ where: { priority: 'CRITICAL', status: { not: 'CLOSED' } } }),
      prisma.consumable.findMany({
        where: { stockQuantity: { lte: 5 } },
        take: 5,
      }),
      prisma.assetAssignment.findMany({
        take: 5,
        orderBy: { allocationDate: 'desc' },
        include: { asset: true, employee: true },
      }),
    ]);

    // Attach category names and department names
    const categories = await prisma.category.findMany();
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const categoryBreakdown = byCategory.map((b) => ({
      name: catMap.get(b.categoryId) || 'Unknown',
      count: b._count.id,
    }));

    const departments = await prisma.department.findMany();
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));
    const departmentBreakdown = byDepartment.map((b) => ({
      name: deptMap.get(b.departmentId!) || 'Unassigned',
      count: b._count.id,
    }));

    const statusBreakdown = byStatus.map((b) => ({
      status: b.status,
      count: b._count.id,
    }));

    return {
      summary: {
        totalAssets,
        assignedAssets,
        availableAssets,
        maintenanceAssets,
        disposedAssets,
        expiringWarrantyCount,
        openTicketsCount,
        criticalTicketsCount,
      },
      categoryBreakdown,
      departmentBreakdown,
      statusBreakdown,
      lowStockConsumables,
      recentAllocations,
    };
  }

  /**
   * Fast real-time asset tag search across tag, id, serial, barcode, name, and custodian
   */
  static async quickSearch(query: string) {
    if (!query || query.trim() === '') {
      return [];
    }
    const q = query.trim();
    return prisma.asset.findMany({
      where: {
        isArchived: false,
        OR: [
          { assetTag: { contains: q } },
          { assetId: { contains: q } },
          { serialNumber: { contains: q } },
          { barcode: { contains: q } },
          { name: { contains: q } },
          {
            currentEmployee: {
              OR: [
                { firstName: { contains: q } },
                { lastName: { contains: q } },
                { employeeId: { contains: q } },
              ],
            },
          },
        ],
      },
      take: 10,
      select: {
        id: true,
        assetId: true,
        assetTag: true,
        name: true,
        serialNumber: true,
        status: true,
        condition: true,
        manufacturer: true,
        model: true,
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        currentEmployee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Track specific asset by tag, ID, or serial with complete relational audit
   */
  static async trackAsset(tagOrId: string) {
    const asset = await this.getAssetById(tagOrId);
    if (!asset) {
      throw new Error(`Asset with Tag/ID '${tagOrId}' not found`);
    }
    return asset;
  }
}
