import { prisma } from '../config/db.js';
import { ExcelService } from '../utils/excelService.js';
import { AssetService } from './assetService.js';

export interface ImportResult {
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ row: number; identifier?: string; reason: string }>;
  createdRecords: any[];
}

export class ImportExportService {
  /**
   * Import Assets from parsed Excel/CSV data rows
   */
  static async importAssets(rows: any[], user?: any): Promise<ImportResult> {
    const result: ImportResult = {
      totalProcessed: rows.length,
      successCount: 0,
      failedCount: 0,
      errors: [],
      createdRecords: [],
    };

    const categories = await prisma.category.findMany();
    const catCodeMap = new Map(categories.map((c) => [c.code.toUpperCase(), c.id]));
    const catNameMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

    const departments = await prisma.department.findMany();
    const deptMap = new Map(departments.map((d) => [d.code.toUpperCase(), d.id]));

    const locations = await prisma.location.findMany();
    const locMap = new Map(locations.map((l) => [l.code.toUpperCase(), l.id]));

    const vendors = await prisma.vendor.findMany();
    const vendorMap = new Map(vendors.map((v) => [v.code.toUpperCase(), v.id]));

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1
      const row = rows[i];

      const name = row['Asset Name'] || row['name'] || row['Name'];
      const serialNumber = String(row['Serial Number'] || row['serialNumber'] || row['Serial'] || '').trim();
      const catIdentifier = String(row['Category Code'] || row['Category'] || '').trim();

      if (!name || !serialNumber) {
        result.failedCount++;
        result.errors.push({
          row: rowNum,
          identifier: serialNumber || 'N/A',
          reason: 'Missing mandatory fields: Asset Name and Serial Number are required.',
        });
        continue;
      }

      // Resolve Category ID
      let categoryId = catCodeMap.get(catIdentifier.toUpperCase()) || catNameMap.get(catIdentifier.toLowerCase());
      if (!categoryId) {
        // Fallback to first available category
        categoryId = categories[0]?.id;
      }

      if (!categoryId) {
        result.failedCount++;
        result.errors.push({
          row: rowNum,
          identifier: serialNumber,
          reason: `Category "${catIdentifier}" not recognized.`,
        });
        continue;
      }

      // Check duplicates
      const existing = await prisma.asset.findFirst({
        where: { serialNumber },
      });

      if (existing) {
        result.failedCount++;
        result.errors.push({
          row: rowNum,
          identifier: serialNumber,
          reason: `Duplicate Serial Number "${serialNumber}" already exists in inventory.`,
        });
        continue;
      }

      try {
        const deptCode = String(row['Department Code'] || row['Department'] || '').trim().toUpperCase();
        const locCode = String(row['Location Code'] || row['Location'] || '').trim().toUpperCase();
        const vndCode = String(row['Vendor Code'] || row['Vendor'] || '').trim().toUpperCase();

        const created = await AssetService.createAsset(
          {
            name,
            serialNumber,
            categoryId,
            customAssetId: row['Asset ID'] || undefined,
            assetTag: row['Asset Tag'] || undefined,
            status: row['Status'] || 'AVAILABLE',
            condition: row['Condition'] || 'GOOD',
            manufacturer: row['Manufacturer'],
            model: row['Model'],
            departmentId: deptMap.get(deptCode),
            locationId: locMap.get(locCode),
            vendorId: vendorMap.get(vndCode),
            purchaseCost: row['Purchase Cost'] ? Number(row['Purchase Cost']) : undefined,
            poNumber: row['PO Number'],
            warrantyStart: row['Warranty Start'],
            warrantyEnd: row['Warranty End'],
            operatingSystem: row['Operating System'],
            cpu: row['CPU'],
            ram: row['RAM'],
            storage: row['Storage'],
          },
          user
        );

        result.successCount++;
        result.createdRecords.push(created.assetId);
      } catch (err: any) {
        result.failedCount++;
        result.errors.push({
          row: rowNum,
          identifier: serialNumber,
          reason: err.message || 'Creation failed due to database constraint.',
        });
      }
    }

    return result;
  }

  /**
   * Import Employees from parsed Excel/CSV data rows
   */
  static async importEmployees(rows: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      totalProcessed: rows.length,
      successCount: 0,
      failedCount: 0,
      errors: [],
      createdRecords: [],
    };

    const departments = await prisma.department.findMany();
    const deptMap = new Map(departments.map((d) => [d.code.toUpperCase(), d.id]));

    const locations = await prisma.location.findMany();
    const locMap = new Map(locations.map((l) => [l.code.toUpperCase(), l.id]));

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];

      const employeeId = String(row['Employee ID'] || row['employeeId'] || '').trim();
      const firstName = String(row['First Name'] || row['firstName'] || '').trim();
      const lastName = String(row['Last Name'] || row['lastName'] || '').trim();
      const email = String(row['Email'] || row['email'] || '').trim().toLowerCase();

      if (!employeeId || !firstName || !email) {
        result.failedCount++;
        result.errors.push({
          row: rowNum,
          identifier: employeeId || 'N/A',
          reason: 'Employee ID, First Name, and Email are mandatory.',
        });
        continue;
      }

      const existing = await prisma.employee.findFirst({
        where: { OR: [{ employeeId }, { email }] },
      });

      if (existing) {
        result.failedCount++;
        result.errors.push({
          row: rowNum,
          identifier: employeeId,
          reason: `Employee with ID "${employeeId}" or Email "${email}" already exists.`,
        });
        continue;
      }

      try {
        const deptCode = String(row['Department Code'] || '').trim().toUpperCase();
        const locCode = String(row['Location Code'] || '').trim().toUpperCase();

        const created = await prisma.employee.create({
          data: {
            employeeId,
            firstName,
            lastName,
            email,
            phone: row['Phone'],
            designation: row['Designation'],
            departmentId: deptMap.get(deptCode),
            locationId: locMap.get(locCode),
            costCenter: row['Cost Center'],
            employmentStatus: row['Status'] || 'ACTIVE',
          },
        });

        result.successCount++;
        result.createdRecords.push(created.employeeId);
      } catch (err: any) {
        result.failedCount++;
        result.errors.push({
          row: rowNum,
          identifier: employeeId,
          reason: err.message || 'Database error occurred.',
        });
      }
    }

    return result;
  }
}
