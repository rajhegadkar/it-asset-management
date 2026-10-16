export type CustomFieldEntity = 'ASSET' | 'EMPLOYEE' | 'TICKET' | 'MAINTENANCE' | 'LICENSE' | 'CONSUMABLE';

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'textarea'
  | 'email'
  | 'url'
  | 'currency';

export interface CustomFieldDefinition {
  id: string;
  entity: CustomFieldEntity;
  name: string; // internal key e.g. 'macAddress2'
  label: string; // user-friendly label e.g. 'Secondary MAC Address'
  type: CustomFieldType;
  required: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[]; // For select type
  categoryId?: string; // Optional: specific to a category
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NumberingSchemeConfig {
  entity: 'ASSET_ID' | 'ASSET_TAG' | 'TICKET' | 'PO';
  prefix: string;
  pattern: string; // e.g. '{PREFIX}-{YYYY}-{CAT}-{SEQ:5}' or 'TAG-{CAT}-{SEQ:6}'
  seqPadding: number;
  currentSeq: number;
  resetFrequency: 'NEVER' | 'YEARLY' | 'MONTHLY';
  lastResetYear?: number;
  lastResetMonth?: number;
  description: string;
}

export interface BrandingConfig {
  companyName: string;
  portalTitle: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string; // e.g. '#2563eb'
  accentColor: string; // e.g. '#10b981'
  headerBgColor: string; // e.g. '#1e293b'
  loginBannerText: string;
  currencySymbol: string; // e.g. '$', '€', '£', '₹', '¥'
  currencyCode: string; // 'USD', 'EUR', 'GBP', 'INR', etc.
  dateFormat: string; // 'YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'
  supportEmail: string;
  supportPhone?: string;
  helpdeskUrl?: string;
  customCss?: string;
}

export interface CustomStatusConfig {
  id: string;
  code: string; // e.g. 'IN_STOCK', 'LOANER_IN_FIELD', 'UNDER_MAINTENANCE'
  name: string; // e.g. 'Loaner in Field'
  category: 'IN_STOCK' | 'IN_USE' | 'MAINTENANCE' | 'DISPOSED' | 'RESERVED';
  color: string; // e.g. 'blue', 'emerald', 'amber', 'rose', 'purple'
  hexColor: string; // e.g. '#3b82f6'
  description?: string;
  isDefault: boolean;
  allowAllocation: boolean;
  isArchived: boolean;
}

export interface EmailTemplateConfig {
  id: string;
  trigger: 'ASSET_ALLOCATED' | 'ASSET_RETURNED' | 'TICKET_CREATED' | 'TICKET_RESOLVED' | 'WARRANTY_EXPIRING' | 'LOW_STOCK';
  name: string;
  subject: string;
  htmlBody: string;
  availableTokens: string[];
  enabled: boolean;
}

export interface PdfLabelConfig {
  labelWidthMm: number; // e.g. 70
  labelHeightMm: number; // e.g. 36
  labelsPerRow: number; // e.g. 3
  labelsPerCol: number; // e.g. 8
  barcodeType: 'CODE128' | 'CODE39' | 'QR' | 'BOTH' | 'BARCODE_ONLY';
  showLogo: boolean;
  headerText: string; // e.g. 'PROPERTY OF ACME CORP'
  includeFields: string[]; // ['assetTag', 'serialNumber', 'model', 'category']
  customHandoverTerms: string;
}

export interface FeatureFlagsConfig {
  enableSamLicenses: boolean;
  enableConsumables: boolean;
  enableEmployeePortal: boolean;
  enableMaintenance: boolean;
  enableCameraScanner: boolean;
  enableHardwareScanner: boolean;
  enableDigitalSignature: boolean;
  require2faAllAdmins: boolean;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
}

export interface FullCustomizationBackup {
  version: string;
  exportedAt: string;
  branding: BrandingConfig;
  numbering: Record<string, NumberingSchemeConfig>;
  customFields: Record<string, CustomFieldDefinition[]>;
  statuses: CustomStatusConfig[];
  emailTemplates: Record<string, EmailTemplateConfig>;
  pdfTemplates: PdfLabelConfig;
  featureFlags: FeatureFlagsConfig;
}
