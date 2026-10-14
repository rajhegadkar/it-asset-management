/**
 * Disaster Recovery & Cloud Backup Types
 * Enterprise IT Asset Management (ITAM) — Version 3.0 Custom Edition
 */

export type CloudStorageProvider = 'LOCAL_NAS' | 'GOOGLE_DRIVE' | 'MICROSOFT_ONEDRIVE' | 'AMAZON_S3' | 'WEBDAV';

export type BackupFrequency = 'MANUAL' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface CloudStorageConfig {
  provider: CloudStorageProvider;
  enabled: boolean;
  frequency: BackupFrequency;
  scheduledTime: string; // "02:00" for daily/weekly
  retentionDays: number; // e.g. 30 days
  autoSyncCloud: boolean;

  // Local / NAS / SMB Network Share
  localPath?: string;

  // Google Drive
  googleDriveFolderId?: string;
  googleServiceAccountJson?: string;
  googleAccessToken?: string;

  // Microsoft OneDrive / SharePoint
  oneDriveFolder?: string;
  oneDriveClientId?: string;
  oneDriveTenantId?: string;
  oneDriveClientSecret?: string;
  oneDriveRefreshToken?: string;

  // Amazon S3 / Cloudflare R2 / MinIO
  s3Bucket?: string;
  s3Region?: string;
  s3Endpoint?: string; // For R2/MinIO
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;

  // WebDAV (Nextcloud / Owncloud)
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
}

export interface BackupManifest {
  manifestVersion: string;
  systemVersion: string;
  backupId: string;
  timestamp: string;
  environment: string;
  databaseType: 'sqlite' | 'postgresql';
  checksumSha256: string;
  fileSize: number;
  recordCounts: Record<string, number>;
  includesUploads: boolean;
  includesCustomizations: boolean;
  createdByUser?: string;
}

export interface BackupHistoryItem {
  id: string;
  filename: string;
  timestamp: string;
  sizeBytes: number;
  formattedSize: string;
  checksumSha256: string;
  status: 'COMPLETED' | 'CLOUD_SYNCED' | 'FAILED';
  cloudProvider?: CloudStorageProvider;
  cloudUrl?: string;
  recordCountTotal: number;
}

export interface RestoreResult {
  success: boolean;
  backupId: string;
  timestamp: string;
  recordsRestored: Record<string, number>;
  totalRecords: number;
  message: string;
}
