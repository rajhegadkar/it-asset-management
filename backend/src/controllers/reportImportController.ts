import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/reportService.js';
import { ImportExportService } from '../services/importExportService.js';
import { ExcelService } from '../utils/excelService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class ReportImportController {
  // --- Reports ---
  static async getInventoryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getInventoryReport(req.query);
      return ApiResponse.success(res, data, 'Inventory report data');
    } catch (error) {
      next(error);
    }
  }

  static async getWarrantyReport(req: Request, res: Response, next: NextFunction) {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
      const data = await ReportService.getWarrantyReport(days);
      return ApiResponse.success(res, data, 'Warranty report data');
    } catch (error) {
      next(error);
    }
  }

  static async getAllocationsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getAllocationsReport();
      return ApiResponse.success(res, data, 'Allocations report data');
    } catch (error) {
      next(error);
    }
  }

  static async getMaintenanceReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getMaintenanceReport();
      return ApiResponse.success(res, data, 'Maintenance report data');
    } catch (error) {
      next(error);
    }
  }

  static async getLicenseReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getLicenseReport();
      return ApiResponse.success(res, data, 'License report data');
    } catch (error) {
      next(error);
    }
  }

  static async getConsumablesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getConsumablesReport();
      return ApiResponse.success(res, data, 'Consumables report data');
    } catch (error) {
      next(error);
    }
  }

  static async getDisposalReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getDisposalReport();
      return ApiResponse.success(res, data, 'Disposal report data');
    } catch (error) {
      next(error);
    }
  }

  // --- Export to XLSX & CSV ---
  static async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      const { entity, format } = req.query; // entity: assets, employees, licenses, etc. format: xlsx, csv, json
      let data: any[] = [];

      if (entity === 'assets') {
        const assets = await ReportService.getInventoryReport(req.query);
        data = assets.map((a) => ({
          'Asset ID': a.assetId,
          'Asset Tag': a.assetTag,
          'Name': a.name,
          'Category': a.category.name,
          'Serial Number': a.serialNumber,
          'Status': a.status,
          'Condition': a.condition,
          'Department': a.department?.name || 'N/A',
          'Location': a.location?.name || 'N/A',
          'Assigned To': a.currentEmployee ? `${a.currentEmployee.firstName} ${a.currentEmployee.lastName}` : 'Unassigned',
          'Purchase Date': a.purchaseDate ? a.purchaseDate.toISOString().split('T')[0] : '',
          'Cost': a.purchaseCost,
          'Warranty End': a.warrantyEnd ? a.warrantyEnd.toISOString().split('T')[0] : '',
        }));
      } else {
        return ApiResponse.error(res, `Unsupported entity type: ${entity}`, 400);
      }

      if (format === 'csv') {
        const csv = ExcelService.generateCsv(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${entity}-export.csv"`);
        return res.send(csv);
      }

      const buffer = ExcelService.generateXlsx(data, `${entity}_Export`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${entity}-export.xlsx"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  // --- Download Templates ---
  static async getTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.params.type; // assets, employees, vendors, locations
      let buffer: Buffer;
      let filename: string;

      switch (type) {
        case 'assets':
          buffer = ExcelService.getAssetTemplateBuffer();
          filename = 'assets_template.xlsx';
          break;
        case 'employees':
          buffer = ExcelService.getEmployeeTemplateBuffer();
          filename = 'employees_template.xlsx';
          break;
        case 'vendors':
          buffer = ExcelService.getVendorTemplateBuffer();
          filename = 'vendors_template.xlsx';
          break;
        case 'locations':
          buffer = ExcelService.getLocationTemplateBuffer();
          filename = 'locations_template.xlsx';
          break;
        default:
          return ApiResponse.error(res, 'Invalid template type requested', 400);
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  // --- Upload & Import ---
  static async importData(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 'No file was uploaded', 400);
      }

      const type = req.params.type; // assets, employees
      const rows = ExcelService.parseBuffer(req.file.buffer || req.file.path ? require('fs').readFileSync(req.file.path) : Buffer.from([]));

      let result;
      if (type === 'assets') {
        result = await ImportExportService.importAssets(rows, req.user);
      } else if (type === 'employees') {
        result = await ImportExportService.importEmployees(rows);
      } else {
        return ApiResponse.error(res, 'Unsupported import type', 400);
      }

      return ApiResponse.success(res, result, `Import process completed: ${result.successCount} succeeded, ${result.failedCount} failed.`);
    } catch (error) {
      next(error);
    }
  }
}
