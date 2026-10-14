export type UserRole = 'SUPER_ADMIN' | 'IT_ADMIN' | 'SUPPORT_ENGINEER' | 'EMPLOYEE';

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  role: {
    id: string;
    name: UserRole;
    displayName: string;
  };
  permissions: string[];
  organization?: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    currency?: string;
  };
  employeeProfile?: {
    id: string;
    employeeId: string;
    departmentId?: string;
  };
}

export interface AssetCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  parentId?: string;
  subcategories?: AssetCategory[];
  customFieldsSchema?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  departmentHead?: string;
  costCenter?: string;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  type: string;
  address?: string;
  parentId?: string;
}

export interface Vendor {
  id: string;
  name: string;
  code: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  designation?: string;
  departmentId?: string;
  department?: Department;
  locationId?: string;
  location?: Location;
  costCenter?: string;
  employmentStatus: string;
  customFields?: Record<string, any> | string;
  assets?: Asset[];
}

export interface AssetAssignment {
  id: string;
  assetId: string;
  asset: Asset;
  employeeId: string;
  employee: Employee;
  allocationType: string;
  allocationDate: string;
  expectedReturnDate?: string;
  accessories?: string;
  termsAccepted: boolean;
  acknowledgedAt?: string;
  status: string;
}

export interface AssetLifecycleLog {
  id: string;
  assetId: string;
  eventType: string;
  description: string;
  fromStatus?: string;
  toStatus?: string;
  performedBy?: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  assetId: string;
  assetTag: string;
  barcode: string;
  qrCode?: string;
  serialNumber: string;
  name: string;
  categoryId: string;
  category: AssetCategory;
  status: 'IN_STOCK' | 'AVAILABLE' | 'ASSIGNED' | 'IN_USE' | 'UNDER_MAINTENANCE' | 'REPAIR' | 'LOST' | 'STOLEN' | 'DAMAGED' | 'RETIRED' | 'DISPOSED';
  condition: 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
  departmentId?: string;
  department?: Department;
  locationId?: string;
  location?: Location;
  vendorId?: string;
  vendor?: Vendor;
  currentEmployeeId?: string;
  currentEmployee?: Employee;
  manufacturer?: string;
  model?: string;
  cpu?: string;
  ram?: string;
  storage?: string;
  operatingSystem?: string;
  ipAddress?: string;
  macAddress?: string;
  hostname?: string;
  purchaseCost?: number;
  purchaseDate?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  warrantyProvider?: string;
  allocationType?: string;
  assignmentDate?: string;
  handoverStatus?: string;
  notes?: string;
  customFields?: Record<string, any> | string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  assignments?: AssetAssignment[];
  lifecycleLogs?: AssetLifecycleLog[];
  maintenanceRecords?: any[];
  tickets?: any[];
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'PENDING_USER' | 'PENDING_VENDOR' | 'RESOLVED' | 'CLOSED';
  requester: Employee;
  assignedEngineer?: User;
  asset?: Asset;
  department?: Department;
  customFields?: Record<string, any> | string;
  slaDueDate?: string;
  resolvedAt?: string;
  createdAt: string;
  comments?: Array<{
    id: string;
    authorName: string;
    comment: string;
    createdAt: string;
  }>;
}

export interface SoftwareLicense {
  id: string;
  softwareName: string;
  publisher: string;
  version?: string;
  licenseType: string;
  licenseKey?: string;
  quantityPurchased: number;
  quantityUsed: number;
  cost?: number;
  vendor?: Vendor;
  expiryDate?: string;
  assignments?: Array<{
    id: string;
    employee?: Employee;
    asset?: Asset;
    assignedDate: string;
  }>;
}

export interface Consumable {
  id: string;
  name: string;
  category: string;
  itemCode: string;
  stockQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  unitCost?: number;
  location?: Location;
  vendor?: Vendor;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  group: string;
}
