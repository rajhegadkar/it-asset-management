import { prisma } from '../config/db.js';
import { BarcodeGenerator } from '../utils/barcodeGenerator.js';
import { PdfService } from '../utils/pdfService.js';
import { logAuditEvent } from '../middlewares/audit.js';
import { SAFE_USER_SELECT } from '../utils/sanitize.js';
import { ci, safeSort, safeOrder, parseDate } from '../utils/dbCompat.js';
import { CustomFieldsEngine } from '../customization/customFieldsEngine.js';
import { WorkflowStatusEngine } from '../customization/workflowStatusEngine.js';

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
import { PdfTemplateEngine } from '../customization/pdfTemplateEngine.js';

// Statuses that may only be set through their workflow endpoints (allocate / return / dispose / archive)
const WORKFLOW_ONLY_STATUSES = ['ASSIGNED', 'DISPOSED', 'RETIRED'];
const SORTABLE = ['createdAt', 'updatedAt', 'name', 'assetId', 'assetTag', 'serialNumber', 'status', 'condition', 'purchaseDate', 'purchaseCost', 'warrantyEnd', 'manufacturer', 'model'];

/** Valid asset status codes: built-in codes plus active custom statuses from the Customization Center. */
export async function validAssetStatuses(): Promise<string[]> {
  const custom = (await WorkflowStatusEngine.getStatuses()).filter((s) => !s.isArchived).map((s) => s.code);
  return Array.from(new Set(['IN_STOCK', 'AVAILABLE', 'ASSIGNED', 'IN_USE', 'UNDER_MAINTENANCE', 'REPAIR', 'LOST', 'STOLEN', 'DAMAGED', 'RETIRED', 'DISPOSED', 'RESERVED', 'RETURNED', ...custom]));
}

/** Validates custom field values against the definitions configured for ASSET in the Customization Center. */
export async function validateCustomFields(values: Record<string, any> | undefined | null, categoryId?: string | null): Promise<Record<string, any>> {
  const defs = (await CustomFieldsEngine.getFields('ASSET')).filter((d) => d.isActive !== false && (!d.categoryId || d.categoryId === categoryId));
  const out: Record<string, any> = { ...(values || {}) };
  const errors: Array<{ field: string; message: string }> = [];
  for (const d of defs) {
    let v = out[d.name];
    const empty = v === undefined || v === null || v === '';
    if (empty && d.defaultValue !== undefined && d.defaultValue !== '') {
      // Apply the configured default only if it is itself valid (older configs had a default outside the option list)
      const defOk = d.type !== 'select' || !d.options?.length || d.options.includes(String(d.defaultValue));
      if (defOk) { out[d.name] = d.defaultValue; v = d.defaultValue; }
    }
    if ((v === undefined || v === null || v === '') ) {
      if (d.required) errors.push({ field: `customFields.${d.name}`, message: `${d.label} is required` });
      continue;
    }
    switch (d.type) {
      case 'number':
      case 'currency':
        if (Number.isNaN(Number(v))) errors.push({ field: `customFields.${d.name}`, message: `${d.label} must be a number` });
        else out[d.name] = Number(v);
        break;
      case 'date':
        if (isNaN(new Date(v).getTime())) errors.push({ field: `customFields.${d.name}`, message: `${d.label} must be a valid date` });
        break;
      case 'checkbox':
        out[d.name] = v === true || v === 'true' || v === 1 || v === '1';
        break;
      case 'select':
        // Legacy short codes (e.g. "TIER_3" from an old default) map to the one option they abbreviate
        if (d.options && d.options.length && !d.options.includes(String(v))) {
          const hits = d.options.filter((o: string) => o.toUpperCase().startsWith(String(v).toUpperCase()));
          if (hits.length === 1) { out[d.name] = hits[0]; break; }
        }
        if (d.options && d.options.length && !d.options.includes(String(v))) errors.push({ field: `customFields.${d.name}`, message: `${d.label} must be one of: ${d.options.join(', ')}` });
        break;
      case 'email':
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v))) errors.push({ field: `customFields.${d.name}`, message: `${d.label} must be an e-mail address` });
        break;
      case 'url':
        if (!/^https?:\/\//i.test(String(v))) errors.push({ field: `customFields.${d.name}`, message: `${d.label} must start with http:// or https://` });
        break;
    }
  }
  if (errors.length) throw { statusCode: 400, message: 'Custom field validation failed', code: 'VALIDATION_ERROR', errors };
  return out;
}

const OPEN_TICKET_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'PENDING_VENDOR', 'REOPENED'];

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
        { assetId: ci(q) },
        { assetTag: ci(q) },
        { serialNumber: ci(q) },
        { name: ci(q) },
        { manufacturer: ci(q) },
        { model: ci(q) },
        { hostname: ci(q) },
        { ipAddress: ci(q) },
        { macAddress: ci(q) },
        {
          currentEmployee: {
            OR: [
              { firstName: ci(q) },
              { lastName: ci(q) },
              { employeeId: ci(q) },
              { email: ci(q) },
            ],
          },
        },
      ];
    }

    const orderBy: any = {};
    orderBy[safeSort(params.sortBy, SORTABLE, 'createdAt')] = safeOrder(params.sortOrder);

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
          include: { requester: true, assignedEngineer: { select: SAFE_USER_SELECT } },
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
    const status = (input.status || 'AVAILABLE').toUpperCase();
    if (WORKFLOW_ONLY_STATUSES.includes(status)) {
      throw { statusCode: 400, message: `New assets cannot be created as ${status}. Create it, then use Allocate / Dispose.`, code: 'INVALID_STATUS' };
    }
    if (!(await validAssetStatuses()).includes(status)) {
      throw { statusCode: 400, message: `Unknown asset status "${status}".`, code: 'INVALID_STATUS' };
    }
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw { statusCode: 400, message: 'Category not found', code: 'INVALID_CATEGORY' };

    // Check the serial number first so a duplicate does not burn an Asset ID / Tag number
    const dupSerial = await prisma.asset.findFirst({ where: { serialNumber: input.serialNumber } });
    if (dupSerial) {
      throw { statusCode: 409, message: `An asset with Serial Number "${input.serialNumber}" already exists.`, code: 'DUPLICATE_SERIAL' };
    }
    if (input.customAssetId || input.assetTag) {
      const dup = await prisma.asset.findFirst({
        where: { OR: [...(input.customAssetId ? [{ assetId: input.customAssetId }] : []), ...(input.assetTag ? [{ assetTag: input.assetTag }, { barcode: input.assetTag }] : [])] },
      });
      if (dup) throw { statusCode: 409, message: `An asset with ID "${input.customAssetId}" or Tag "${input.assetTag}" already exists.`, code: 'DUPLICATE_ASSET_ID' };
    }

    const customFields = await validateCustomFields(
      typeof input.customFields === 'string' ? JSON.parse(input.customFields as any) : input.customFields,
      input.categoryId
    );

    const assetId = input.customAssetId || (await this.generateAssetId(input.categoryId));
    const assetTag = input.assetTag || (await this.generateAssetTag(input.categoryId));

    const asset = await prisma.asset.create({
      data: {
        assetId,
        assetTag,
        barcode: assetTag,
        qrCode: assetTag,
        serialNumber: input.serialNumber,
        name: input.name,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId || null,
        status,
        condition: input.condition || 'NEW',
        departmentId: input.departmentId || null,
        locationId: input.locationId || null,
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
        vendorId: input.vendorId || null,
        poNumber: input.poNumber,
        invoiceNumber: input.invoiceNumber,
        purchaseDate: parseDate(input.purchaseDate, 'purchaseDate'),
        purchaseCost: input.purchaseCost ? Number(input.purchaseCost) : 0,
        currency: input.currency || 'USD',
        warrantyStart: parseDate(input.warrantyStart, 'warrantyStart'),
        warrantyEnd: parseDate(input.warrantyEnd, 'warrantyEnd'),
        warrantyProvider: input.warrantyProvider,
        amcStart: parseDate(input.amcStart, 'amcStart'),
        amcEnd: parseDate(input.amcEnd, 'amcEnd'),
        contractNumber: input.contractNumber,
        expectedLifeYears: input.expectedLifeYears ? Number(input.expectedLifeYears) : 3,
        customFields: Object.keys(customFields).length ? JSON.stringify(customFields) : null,
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
   * Update Asset. Input must already be validated by updateAssetSchema (allow-listed fields only).
   * Custody, archive and disposal fields are never writable here: use the workflow endpoints.
   */
  static async updateAsset(id: string, input: Partial<CreateAssetInput>, user?: any) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw { statusCode: 404, message: 'Asset not found', code: 'ASSET_NOT_FOUND' };
    }
    if (existing.isArchived || existing.status === 'DISPOSED') {
      throw { statusCode: 400, message: 'Retired or disposed assets cannot be edited.', code: 'ASSET_INACTIVE' };
    }

    const data: any = { ...input };
    delete data.customAssetId;

    if (input.status !== undefined && input.status !== existing.status) {
      const next = String(input.status).toUpperCase();
      if (WORKFLOW_ONLY_STATUSES.includes(next)) {
        throw { statusCode: 400, message: `Status ${next} can only be set through the Allocate / Archive / Dispose workflow.`, code: 'INVALID_STATUS_TRANSITION' };
      }
      if (existing.currentEmployeeId && !['IN_USE'].includes(next)) {
        throw { statusCode: 400, message: 'This asset is assigned to an employee. Return or transfer it before changing its status.', code: 'INVALID_STATUS_TRANSITION' };
      }
      if (!(await validAssetStatuses()).includes(next)) {
        throw { statusCode: 400, message: `Unknown asset status "${next}".`, code: 'INVALID_STATUS' };
      }
      data.status = next;
    }

    for (const f of ['purchaseDate', 'warrantyStart', 'warrantyEnd', 'amcStart', 'amcEnd'] as const) {
      if ((input as any)[f] !== undefined) data[f] = parseDate((input as any)[f], f);
    }
    for (const f of ['departmentId', 'locationId', 'vendorId', 'subcategoryId'] as const) {
      if ((input as any)[f] === '') data[f] = null;
    }
    if (input.customFields !== undefined) {
      const cf = await validateCustomFields(
        typeof input.customFields === 'string' ? JSON.parse(input.customFields as any) : input.customFields,
        input.categoryId || existing.categoryId
      );
      data.customFields = Object.keys(cf).length ? JSON.stringify(cf) : null;
    }
    if (input.portCount !== undefined) data.portCount = input.portCount === null || (input.portCount as any) === '' ? null : Number(input.portCount);
    if (input.purchaseCost !== undefined) data.purchaseCost = Number(input.purchaseCost) || 0;
    if (input.assetTag !== undefined && input.assetTag !== existing.assetTag) {
      data.barcode = input.assetTag;
      data.qrCode = input.assetTag;
    }

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

    const changed: Record<string, { from: any; to: any }> = {};
    for (const k of Object.keys(data)) {
      const before = (existing as any)[k];
      const after = (updated as any)[k];
      if (String(before ?? '') !== String(after ?? '')) changed[k] = { from: before, to: after };
    }

    await prisma.assetLifecycleLog.create({
      data: {
        assetId: id,
        eventType: 'UPDATE',
        description: Object.keys(changed).length ? `Updated: ${Object.keys(changed).join(', ')}` : 'Asset record saved (no changes)',
        fromStatus: existing.status,
        toStatus: updated.status,
        performedById: user?.id,
        performedBy: user ? `${user.firstName || user.username}` : 'System',
        metadata: JSON.stringify(changed).slice(0, 10000),
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
  static async generateLabelsPdf(
    assetIds?: string[],
    all?: boolean,
    requestedStyle?: string,
    showUserName?: boolean
  ): Promise<Buffer> {
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

    // Resolve sticker format from query/body parameter, barcode.sticker_style, or customization.pdf_labels
    let resolvedStyle = requestedStyle;
    if (!resolvedStyle) {
      const styleSetting = await prisma.systemSetting.findUnique({ where: { key: 'barcode.sticker_style' } });
      if (styleSetting?.value) {
        resolvedStyle = styleSetting.value;
      } else {
        const pdfCustomSetting = await prisma.systemSetting.findUnique({ where: { key: 'customization.pdf_labels' } });
        if (pdfCustomSetting?.value) {
          try {
            const parsed = JSON.parse(pdfCustomSetting.value);
            if (parsed.barcodeType === 'CODE128' || parsed.barcodeType === 'CODE39' || parsed.barcodeType === 'BARCODE_ONLY') {
              resolvedStyle = 'BARCODE_ONLY';
            } else if (parsed.barcodeType === 'BOTH') {
              resolvedStyle = 'BOTH';
            } else if (parsed.barcodeType === 'QR' || parsed.barcodeType === 'QR_ONLY') {
              resolvedStyle = 'QR_ONLY';
            }
          } catch {}
        }
      }
    }
    const stickerStyle = (resolvedStyle || 'QR_ONLY').toUpperCase();

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

    // User name on the label: explicit per-print choice wins, otherwise the Customization Centre setting
    // (SHOW / ASK print it by default, HIDE leaves it off).
    let includeUserName = showUserName;
    if (includeUserName === undefined) {
      const cfg = await PdfTemplateEngine.getConfig();
      includeUserName = cfg.userNameOnLabel !== 'HIDE';
    }

    return await PdfService.generateAssetLabelSheet(labelData, stickerStyle, { showUserName: includeUserName });
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
      prisma.asset.count({ where: { isArchived: false, status: { in: ['ASSIGNED', 'IN_USE'] } } }),
      prisma.asset.count({ where: { isArchived: false, status: 'AVAILABLE' } }),
      prisma.asset.count({ where: { isArchived: false, status: { in: ['UNDER_MAINTENANCE', 'REPAIR'] } } }),
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
      prisma.ticket.count({ where: { status: { in: OPEN_TICKET_STATUSES } } }),
      prisma.ticket.count({ where: { priority: 'CRITICAL', status: { in: OPEN_TICKET_STATUSES } } }),
      // Low stock = at or below each item's own minimum, not a fixed number
      prisma.consumable.findMany({
        where: { stockQuantity: { lte: prisma.consumable.fields.minQuantity } },
        orderBy: { stockQuantity: 'asc' },
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
          { assetTag: ci(q) },
          { assetId: ci(q) },
          { serialNumber: ci(q) },
          { barcode: ci(q) },
          { name: ci(q) },
          {
            currentEmployee: {
              OR: [
                { firstName: ci(q) },
                { lastName: ci(q) },
                { employeeId: ci(q) },
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
