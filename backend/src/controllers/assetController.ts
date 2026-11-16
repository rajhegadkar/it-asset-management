import { Request, Response, NextFunction } from 'express';
import { AssetService } from '../services/assetService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { z } from 'zod';

const createAssetSchema = z.object({
  name: z.string().min(1, 'Asset name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  subcategoryId: z.string().optional(),
  serialNumber: z.string().min(1, 'Serial number is required'),
  assetTag: z.string().optional(),
  customAssetId: z.string().optional(),
  status: z.string().optional(),
  condition: z.string().optional(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  costCenter: z.string().optional(),
  businessUnit: z.string().optional(),
  floor: z.string().optional(),
  room: z.string().optional(),
  rack: z.string().optional(),
  manufacturer: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  partNumber: z.string().optional(),
  cpu: z.string().optional(),
  cpuGeneration: z.string().optional(),
  ram: z.string().optional(),
  storage: z.string().optional(),
  gpu: z.string().optional(),
  operatingSystem: z.string().optional(),
  osVersion: z.string().optional(),
  macAddress: z.string().optional(),
  ipAddress: z.string().optional(),
  hostname: z.string().optional(),
  managementIp: z.string().optional(),
  vlan: z.string().optional(),
  firmwareVersion: z.string().optional(),
  portCount: z.union([z.number(), z.string()]).optional().transform((v) => (v ? Number(v) : undefined)),
  rackUnit: z.string().optional(),
  datacenter: z.string().optional(),
  vendorId: z.string().optional(),
  poNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.union([z.number(), z.string()]).optional().transform((v) => (v ? Number(v) : undefined)),
  currency: z.string().optional(),
  warrantyStart: z.string().optional(),
  warrantyEnd: z.string().optional(),
  warrantyProvider: z.string().optional(),
  amcStart: z.string().optional(),
  amcEnd: z.string().optional(),
  contractNumber: z.string().optional(),
  expectedLifeYears: z.union([z.number(), z.string()]).optional().transform((v) => (v ? Number(v) : undefined)),
  customFields: z.record(z.any()).optional(),
  notes: z.string().optional(),
  description: z.string().optional(),
});

// Update = same fields as create, all optional. Unknown keys (currentEmployeeId, isArchived,
// assetId, barcode, disposal*, etc.) are stripped by zod, so they cannot be mass-assigned.
const updateAssetSchema = createAssetSchema
  .omit({ customAssetId: true })
  .partial()
  .extend({
    // allow explicit clearing of optional dates / links from the edit form
    purchaseDate: z.string().nullable().optional(),
    warrantyStart: z.string().nullable().optional(),
    warrantyEnd: z.string().nullable().optional(),
    amcStart: z.string().nullable().optional(),
    amcEnd: z.string().nullable().optional(),
  });

const DATE_KEYS = new Set(['purchaseDate', 'warrantyStart', 'warrantyEnd', 'amcStart', 'amcEnd']);
/** Forms send null for empty DB values; treat null as "not provided" (dates: null = clear). */
function normalizeNulls(body: any) {
  if (!body || typeof body !== 'object') return body;
  const out: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === null && !DATE_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export class AssetController {
  static async getAssets(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, categoryId, departmentId, locationId, status, condition, vendorId, employeeId, page, limit, sortBy, sortOrder } = req.query;

      const result = await AssetService.getAssets({
        search: search as string,
        categoryId: categoryId as string,
        departmentId: departmentId as string,
        locationId: locationId as string,
        status: status as string,
        condition: condition as string,
        vendorId: vendorId as string,
        employeeId: employeeId as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        sortBy: sortBy as string,
        sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
      });

      return ApiResponse.success(res, result.assets, 'Assets retrieved successfully', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  static async getAssetById(req: Request, res: Response, next: NextFunction) {
    try {
      const asset = await AssetService.getAssetById(req.params.id);
      return ApiResponse.success(res, asset, 'Asset details retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createAssetSchema.parse(normalizeNulls(req.body));
      const asset = await AssetService.createAsset(validated, req.user);
      return ApiResponse.success(res, asset, 'Asset created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateAssetSchema.parse(normalizeNulls(req.body));
      const updated = await AssetService.updateAsset(req.params.id, validated as any, req.user);
      return ApiResponse.success(res, updated, 'Asset updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async archiveAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AssetService.archiveAsset(req.params.id, req.user);
      return ApiResponse.success(res, result, 'Asset successfully archived');
    } catch (error) {
      next(error);
    }
  }

  static async generateLabelsPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const all = req.body?.all === true || req.query?.all === 'true' || req.body?.assetIds === 'all';
      let assetIds: string[] = [];

      if (Array.isArray(req.body?.assetIds)) {
        assetIds = req.body.assetIds.filter((x: unknown) => typeof x === 'string' && x).slice(0, 2000);
      } else if (typeof req.query?.assetIds === 'string') {
        assetIds = req.query.assetIds.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (req.params?.id) {
        assetIds = [req.params.id];
      }

      if (!all && assetIds.length === 0) {
        return ApiResponse.error(res, 'Asset IDs or all=true is required to generate labels', 400);
      }

      const requestedStyle = (req.body?.style || req.query?.style as string) || undefined;
      // Optional per-print choice: true/false. When absent the Customization Centre setting decides.
      const rawShow = req.body?.showUserName ?? req.query?.showUserName;
      const showUserName =
        rawShow === true || rawShow === 'true' ? true : rawShow === false || rawShow === 'false' ? false : undefined;
      const pdfBuffer = await AssetService.generateLabelsPdf(assetIds, all, requestedStyle, showUserName);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="asset-labels-v2.pdf"');
      return res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  static async getDashboardMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = await AssetService.getDashboardMetrics();
      return ApiResponse.success(res, metrics, 'Dashboard analytics retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async quickSearch(req: Request, res: Response, next: NextFunction) {
    try {
      const q = (req.query.q as string) || '';
      const results = await AssetService.quickSearch(q);
      return ApiResponse.success(res, results, 'Quick search results retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async trackAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.params.tag || (req.query.tag as string);
      const asset = await AssetService.trackAsset(query);
      return ApiResponse.success(res, asset, 'Asset track record retrieved');
    } catch (error) {
      next(error);
    }
  }
}
