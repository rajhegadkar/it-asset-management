import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/reportService.js';
import { ImportExportService } from '../services/importExportService.js';
import { ExcelService } from '../utils/excelService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { prisma } from '../config/db.js';

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
      const { entity, format } = req.query; // entity: assets, inventory, warranty, allocations, maintenance, licenses, consumables, disposals, employees. format: xlsx, csv
      const ent = (entity as string || 'assets').toLowerCase();
      let data: any[] = [];

      if (ent === 'assets' || ent === 'inventory') {
        const assets = await ReportService.getInventoryReport(req.query);
        data = assets.map((a) => ({
          'Asset ID': a.assetId,
          'Asset Tag': a.assetTag,
          'Name': a.name,
          'Category': a.category?.name || 'General',
          'Serial Number': a.serialNumber || 'N/A',
          'Status': a.status,
          'Condition': a.condition,
          'Department': a.department?.name || 'N/A',
          'Location': a.location?.name || 'N/A',
          'Assigned To': a.currentEmployee ? `${a.currentEmployee.firstName} ${a.currentEmployee.lastName}` : 'Unassigned',
          'Purchase Date': a.purchaseDate ? a.purchaseDate.toISOString().split('T')[0] : '',
          'Cost': a.purchaseCost || 0,
          'Warranty End': a.warrantyEnd ? a.warrantyEnd.toISOString().split('T')[0] : '',
        }));
      } else if (ent === 'warranty') {
        const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
        const assets = await ReportService.getWarrantyReport(days);
        data = assets.map((a) => ({
          'Asset Tag': a.assetTag,
          'Asset Name': a.name,
          'Serial Number': a.serialNumber || 'N/A',
          'Category': a.category?.name || 'General',
          'Department': a.department?.name || 'N/A',
          'Assigned To': a.currentEmployee ? `${a.currentEmployee.firstName} ${a.currentEmployee.lastName}` : 'Unassigned',
          'Vendor': a.vendor?.name || 'N/A',
          'Warranty End': a.warrantyEnd ? a.warrantyEnd.toISOString().split('T')[0] : 'N/A',
          'Contract No': a.contractNumber || 'N/A',
        }));
      } else if (ent === 'allocations') {
        const allocations = await ReportService.getAllocationsReport();
        data = allocations.map((al) => ({
          'Asset Tag': al.asset?.assetTag || 'N/A',
          'Asset Name': al.asset?.name || 'N/A',
          'Employee ID': al.employee?.employeeId || 'N/A',
          'Employee Name': al.employee ? `${al.employee.firstName} ${al.employee.lastName}` : 'N/A',
          'Department': al.employee?.department?.name || 'N/A',
          'Allocation Date': al.allocationDate ? al.allocationDate.toISOString().split('T')[0] : '',
          'Expected Return': al.expectedReturnDate ? al.expectedReturnDate.toISOString().split('T')[0] : 'Indefinite',
          'Allocation Type': al.allocationType,
          'Handover Status': al.status,
          'Terms Accepted': al.termsAccepted ? 'YES' : 'PENDING',
        }));
      } else if (ent === 'maintenance') {
        const records = await ReportService.getMaintenanceReport();
        data = records.map((m) => ({
          'Asset Tag': m.asset?.assetTag || 'N/A',
          'Asset Name': m.asset?.name || 'N/A',
          'Maintenance Type': m.maintenanceType,
          'Issue Description': m.issue,
          'Vendor': m.vendor?.name || 'Internal',
          'Start Date': m.startDate ? m.startDate.toISOString().split('T')[0] : '',
          'End Date': m.endDate ? m.endDate.toISOString().split('T')[0] : 'In Progress',
          'Cost': m.cost || 0,
          'Downtime Hours': m.downtimeHours || 0,
        }));
      } else if (ent === 'licenses') {
        const licenses = await ReportService.getLicenseReport();
        data = licenses.map((l) => ({
          'Software Name': l.softwareName,
          'Publisher': l.publisher,
          'License Type': l.licenseType,
          'Seats Purchased': l.quantityPurchased,
          'Seats Used': l.quantityUsed,
          'Cost': l.cost || 0,
          'Vendor': l.vendor?.name || 'N/A',
          'Expiry Date': l.expiryDate ? l.expiryDate.toISOString().split('T')[0] : 'Perpetual',
          'Renewal Date': l.renewalDate ? l.renewalDate.toISOString().split('T')[0] : 'N/A',
        }));
      } else if (ent === 'consumables') {
        const consumables = await ReportService.getConsumablesReport();
        data = consumables.map((c) => ({
          'Item Name': c.name,
          'Item Code': c.itemCode,
          'Category': c.category,
          'Current Stock': c.stockQuantity,
          'Min Alert Stock': c.minQuantity,
          'Max Stock': c.maxQuantity,
          'Unit Cost': c.unitCost || 0,
          'Location': c.location?.name || 'N/A',
          'Vendor': c.vendor?.name || 'N/A',
        }));
      } else if (ent === 'disposals') {
        const disposals = await ReportService.getDisposalReport();
        data = disposals.map((d) => ({
          'Asset Tag': d.assetTag,
          'Name': d.name,
          'Category': d.category?.name || 'General',
          'Department': d.department?.name || 'N/A',
          'Disposal Date': d.disposalDate ? d.disposalDate.toISOString().split('T')[0] : '',
          'Disposal Reason': d.disposalReason || 'N/A',
          'Disposal Method': d.disposalMethod || 'N/A',
          'Disposal Value': d.disposalValue || 0,
        }));
      } else if (ent === 'employees') {
        const employees = await prisma.employee.findMany({
          include: { department: true, location: true },
          orderBy: { employeeId: 'asc' },
        });
        data = employees.map((e) => ({
          'Employee ID': e.employeeId,
          'First Name': e.firstName,
          'Last Name': e.lastName,
          'Email': e.email,
          'Phone': e.phone || 'N/A',
          'Designation': e.designation || 'N/A',
          'Department': e.department?.name || 'N/A',
          'Location': e.location?.name || 'N/A',
          'Status': e.employmentStatus,
        }));
      } else {
        return ApiResponse.error(res, `Unsupported entity type: ${entity}`, 400);
      }

      if (data.length === 0) {
        data = [{ 'Notice': `No records found for ${ent} audit report` }];
      }

      if (format === 'csv') {
        const csv = ExcelService.generateCsv(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${ent}-audit-report.csv"`);
        return res.send(csv);
      }

      const buffer = ExcelService.generateXlsx(data, `${ent.toUpperCase()}_Audit`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${ent}-audit-report.xlsx"`);
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
