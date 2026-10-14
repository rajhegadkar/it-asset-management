import * as XLSX from 'xlsx';

export class ExcelService {
  /**
   * Parse uploaded Buffer (XLSX or CSV) into JSON array of rows
   */
  static parseBuffer(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  }

  /**
   * Generate an XLSX Buffer from data rows
   */
  static generateXlsx(data: any[], sheetName: string = 'Sheet1'): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Generate a CSV string from data rows
   */
  static generateCsv(data: any[]): string {
    const worksheet = XLSX.utils.json_to_sheet(data);
    return XLSX.utils.sheet_to_csv(worksheet);
  }

  /**
   * Generate pre-filled downloadable template buffers
   */
  static getAssetTemplateBuffer(): Buffer {
    const sampleRows = [
      {
        'Asset ID': 'IT-LAP-000101',
        'Asset Tag': 'TAG-DL-7440-101',
        'Asset Name': 'Dell Latitude 7440',
        'Category Code': 'CAT-LAPTOP',
        'Manufacturer': 'Dell',
        'Model': 'Latitude 7440',
        'Serial Number': 'SN-DELL-7440-DEMO1',
        'Status': 'AVAILABLE',
        'Condition': 'NEW',
        'Department Code': 'ENG',
        'Location Code': 'LOC-HQ-B1-F4',
        'Purchase Cost': 1850.0,
        'Vendor Code': 'VND-DELL',
        'PO Number': 'PO-2024-991',
        'Warranty Start': '2024-01-15',
        'Warranty End': '2027-01-15',
        'Operating System': 'Windows 11 Pro',
        'CPU': 'Intel Core i7-1365U',
        'RAM': '32GB',
        'Storage': '1TB NVMe',
      },
    ];
    return this.generateXlsx(sampleRows, 'Assets_Template');
  }

  static getEmployeeTemplateBuffer(): Buffer {
    const sampleRows = [
      {
        'Employee ID': 'EMP-010',
        'First Name': 'Alice',
        'Last Name': 'Smith',
        'Email': 'alice.smith@acme-corp.com',
        'Phone': '+1 415-555-0199',
        'Designation': 'Senior DevOps Engineer',
        'Department Code': 'IT',
        'Location Code': 'LOC-HQ-B1-F4',
        'Joining Date': '2024-03-01',
        'Cost Center': 'CC-IT-101',
        'Status': 'ACTIVE',
      },
    ];
    return this.generateXlsx(sampleRows, 'Employees_Template');
  }

  static getVendorTemplateBuffer(): Buffer {
    const sampleRows = [
      {
        'Vendor Code': 'VND-LENOVO',
        'Vendor Name': 'Lenovo Global Technology',
        'Contact Person': 'Mark Davis',
        'Email': 'sales@lenovo-commercial.com',
        'Phone': '+1 800-426-7378',
        'Website': 'https://www.lenovo.com',
        'Tax ID': 'US-NC-LEN-881',
        'Payment Terms': 'Net 30',
      },
    ];
    return this.generateXlsx(sampleRows, 'Vendors_Template');
  }

  static getLocationTemplateBuffer(): Buffer {
    const sampleRows = [
      {
        'Location Code': 'LOC-CHI-B1',
        'Location Name': 'Chicago Branch Office',
        'Type': 'OFFICE',
        'Parent Code': 'LOC-HQ',
        'Address': '233 S Wacker Dr, Chicago, IL',
      },
    ];
    return this.generateXlsx(sampleRows, 'Locations_Template');
  }
}
