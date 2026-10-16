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
  name: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  categoryId?: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NumberingSchemeConfig {
  entity: 'ASSET_ID' | 'ASSET_TAG' | 'TICKET' | 'PO';
  prefix: string;
  pattern: string;
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
  primaryColor: string;
  accentColor: string;
  headerBgColor: string;
  loginBannerText: string;
  currencySymbol: string;
  currencyCode: string;
  dateFormat: string;
  supportEmail: string;
  supportPhone?: string;
  helpdeskUrl?: string;
  customCss?: string;
}

export interface CustomStatusConfig {
  id: string;
  code: string;
  name: string;
  category: 'IN_STOCK' | 'IN_USE' | 'MAINTENANCE' | 'DISPOSED' | 'RESERVED';
  color: string;
  hexColor: string;
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
  labelWidthMm: number;
  labelHeightMm: number;
  labelsPerRow: number;
  labelsPerCol: number;
  barcodeType: 'CODE128' | 'CODE39' | 'QR' | 'BOTH' | 'BARCODE_ONLY';
  showLogo: boolean;
  headerText: string;
  includeFields: string[];
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
