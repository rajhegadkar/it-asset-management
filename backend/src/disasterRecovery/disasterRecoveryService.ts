/**
 * Enterprise Disaster Recovery & Cloud Backup Engine (v3.1.0)
 *
 * Archive format v2 (".itam-backup"):
 *   { manifest, formatVersion: 2, encrypted: true, signature, archiveData }
 *   - archiveData = AES-256-GCM( gzip(JSON payload) ), base64
 *   - signature   = HMAC-SHA256 over manifest + archiveData (tamper-evident; a recomputed SHA-256 is not enough)
 *   - Key: BACKUP_ENCRYPTION_KEY > SETTINGS_ENCRYPTION_KEY > JWT_SECRET. Keep this key safe and OFF this
 *     server: without it the archives cannot be restored.
 *
 * Legacy v1 archives (unencrypted, checksum only) can still be restored.
 *
 * Off-site copies: LOCAL_NAS (network share), AMAZON_S3 (+ R2 / MinIO), WEBDAV, GOOGLE_DRIVE, MICROSOFT_ONEDRIVE
 * are real uploads (see cloudProviders.ts). A failed upload is reported, never shown as success.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { SecretBox, SECRET_MASK } from '../utils/secretBox.js';
import { CustomizationExportImport } from '../customization/customizationExportImport.js';
import { CloudProviders } from './cloudProviders.js';
import { CloudStorageConfig, BackupManifest, BackupHistoryItem, RestoreResult } from './types.js';

const BACKUP_DIR = path.resolve(process.cwd(), process.env.BACKUP_DIR || 'backups');
const UPLOADS_DIR = path.resolve(process.cwd(), env.UPLOAD_DIR || 'uploads');

/** Path of the live SQLite file, taken from DATABASE_URL (not guessed from the working directory). */
function sqliteDbPath(): string | null {
  const url = env.DATABASE_URL || '';
  if (!url.startsWith('file:')) return null;
  const p = url.slice(5).split('?')[0];
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

const isPostgres = () => /^postgres(ql)?:/i.test(env.DATABASE_URL || '');

const SECRET_FIELDS: Array<keyof CloudStorageConfig> = [
  'googleServiceAccountJson',
  'googleAccessToken',
  'oneDriveClientSecret',
  'oneDriveRefreshToken',
  's3SecretAccessKey',
  'webdavPassword',
];

export const DEFAULT_DR_CONFIG: CloudStorageConfig = {
  provider: 'LOCAL_NAS',
  enabled: true,
  frequency: 'DAILY',
  scheduledTime: '02:00',
  retentionDays: 30,
  autoSyncCloud: false,
  localPath: path.resolve(process.cwd(), 'backups/remote_archive'),
};

function backupKey(purpose: 'enc' | 'mac'): Buffer {
  const material = env.BACKUP_ENCRYPTION_KEY || env.SETTINGS_ENCRYPTION_KEY || env.JWT_SECRET;
  return crypto.createHash('sha256').update(`itam-backup-${purpose}:${material}`).digest();
}

function signBundle(manifest: any, archiveData: string): string {
  return crypto.createHmac('sha256', backupKey('mac')).update(JSON.stringify(manifest)).update('\n').update(archiveData).digest('hex');
}

function encryptArchive(plain: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', backupKey('enc'), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function decryptArchive(b64: string): Buffer {
  const raw = Buffer.from(b64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', backupKey('enc'), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
}

/** Resolves a path from an archive and refuses anything that escapes the uploads directory. */
export function safeUploadPath(relativePath: string): string | null {
  if (typeof relativePath !== 'string' || !relativePath || relativePath.includes('\0')) return null;
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return null;
  const full = path.resolve(UPLOADS_DIR, normalized);
  if (full !== UPLOADS_DIR && !full.startsWith(UPLOADS_DIR + path.sep)) return null;
  return full;
}

// Restore order: parents before children. Delete runs in reverse.
const TABLES: Array<{ key: string; model: string; selfRef?: string }> = [
  { key: 'organizations', model: 'organization' },
  { key: 'roles', model: 'role' },
  { key: 'permissions', model: 'permission' },
  { key: 'rolePermissions', model: 'rolePermission' },
  { key: 'users', model: 'user' },
  { key: 'locations', model: 'location', selfRef: 'parentId' },
  { key: 'departments', model: 'department' },
  { key: 'vendors', model: 'vendor' },
  { key: 'categories', model: 'category', selfRef: 'parentId' },
  { key: 'employees', model: 'employee', selfRef: 'managerId' },
  { key: 'assets', model: 'asset' },
  { key: 'assignments', model: 'assetAssignment' },
  { key: 'returns', model: 'assetReturn' },
  { key: 'transfers', model: 'assetTransfer' },
  { key: 'lifecycleLogs', model: 'assetLifecycleLog' },
  { key: 'maintenanceRecords', model: 'maintenanceRecord' },
  { key: 'licenses', model: 'softwareLicense' },
  { key: 'licenseAssignments', model: 'licenseAssignment' },
  { key: 'consumables', model: 'consumable' },
  { key: 'consumableTransactions', model: 'consumableTransaction' },
  { key: 'tickets', model: 'ticket' },
  { key: 'ticketComments', model: 'ticketComment' },
  { key: 'settings', model: 'systemSetting' },
  { key: 'auditLogs', model: 'auditLog' },
  { key: 'notifications', model: 'notification' },
  { key: 'loginHistories', model: 'loginHistory' },
  { key: 'attachments', model: 'attachment' },
  { key: 'numberSequences', model: 'numberSequence' },
];

/** Orders rows so that a row's self-referenced parent is inserted before it. */
function parentsFirst(rows: any[], field: string): any[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const done = new Set<string>();
  const out: any[] = [];
  const visit = (r: any, depth = 0) => {
    if (done.has(r.id) || depth > 100) return;
    const parentId = r[field];
    if (parentId && byId.has(parentId)) visit(byId.get(parentId), depth + 1);
    if (!done.has(r.id)) {
      done.add(r.id);
      out.push(r);
    }
  };
  rows.forEach((r) => visit(r));
  return out;
}

export class DisasterRecoveryService {
  private static ensureDir() {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  /** Full configuration with secrets decrypted (internal use only). */
  static async getConfig(): Promise<CloudStorageConfig> {
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: 'disaster_recovery.config' } });
      if (setting && setting.value) {
        const stored = JSON.parse(setting.value);
        for (const f of SECRET_FIELDS) if (stored[f]) stored[f] = SecretBox.decrypt(stored[f]);
        return { ...DEFAULT_DR_CONFIG, ...stored };
      }
    } catch (e) {
      logger.warn('Failed to load DR config, using default:', e);
    }
    return { ...DEFAULT_DR_CONFIG };
  }

  /** Configuration safe to show in the browser: secrets replaced by a mask. */
  static async getPublicConfig(): Promise<CloudStorageConfig & { configuredSecrets: string[] }> {
    const cfg: any = await this.getConfig();
    const configuredSecrets: string[] = [];
    for (const f of SECRET_FIELDS) {
      if (cfg[f]) {
        configuredSecrets.push(f);
        cfg[f] = SECRET_MASK;
      }
    }
    return { ...cfg, configuredSecrets };
  }

  /** Merges a form submission with the stored config; masked secret values mean "unchanged". */
  static async mergeWithStored(config: Partial<CloudStorageConfig>): Promise<CloudStorageConfig> {
    const current = await this.getConfig();
    const merged: any = { ...current };
    for (const [k, v] of Object.entries(config || {})) {
      if (k === 'configuredSecrets') continue;
      if (SECRET_FIELDS.includes(k as any) && SecretBox.isMasked(v as any)) continue;
      merged[k] = v;
    }
    return merged;
  }

  static async updateConfig(config: Partial<CloudStorageConfig>): Promise<CloudStorageConfig> {
    const updated: any = await this.mergeWithStored(config);
    const allowedFreq = ['MANUAL', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'];
    if (!allowedFreq.includes(updated.frequency)) updated.frequency = 'DAILY';
    updated.retentionDays = Math.min(3650, Math.max(1, Number(updated.retentionDays) || 30));
    if (!/^\d{1,2}:\d{2}$/.test(updated.scheduledTime || '')) updated.scheduledTime = '02:00';

    const toStore: any = { ...updated };
    for (const f of SECRET_FIELDS) if (toStore[f]) toStore[f] = SecretBox.encrypt(toStore[f]);

    await prisma.systemSetting.upsert({
      where: { key: 'disaster_recovery.config' },
      update: { value: JSON.stringify(toStore), group: 'DISASTER_RECOVERY' },
      create: { key: 'disaster_recovery.config', value: JSON.stringify(toStore), group: 'DISASTER_RECOVERY' },
    });
    return this.getPublicConfig();
  }

  /**
   * 1. CREATE FULL BACKUP ARCHIVE (encrypted + signed)
   */
  static async createBackup(user?: any): Promise<{ manifest: BackupManifest; filePath: string; filename: string; cloud?: { success: boolean; message: string } }> {
    this.ensureDir();
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `itam_dr_${timestampStr}`;
    const filename = `${backupId}.itam-backup`;
    const targetFile = path.join(BACKUP_DIR, filename);

    if (!isPostgres()) {
      try {
        await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch {
        /* not in WAL mode */
      }
    }

    // 1.2 Portable snapshot of every table (used for PostgreSQL and as a fallback for SQLite)
    const portableData: Record<string, any[]> = {};
    for (const t of TABLES) {
      portableData[t.key] = await (prisma as any)[t.model].findMany();
    }
    const recordCounts: Record<string, number> = {};
    for (const [k, rows] of Object.entries(portableData)) recordCounts[k] = rows.length;

    const customizations = await CustomizationExportImport.exportAll();

    const uploadsMap: Record<string, string> = {};
    if (fs.existsSync(UPLOADS_DIR)) {
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.isFile()) uploadsMap[path.relative(UPLOADS_DIR, full).replace(/\\/g, '/')] = fs.readFileSync(full).toString('base64');
        }
      };
      walk(UPLOADS_DIR);
    }

    const dbPath = sqliteDbPath();
    const sqliteBinary = dbPath && fs.existsSync(dbPath) ? fs.readFileSync(dbPath).toString('base64') : '';

    const payload = JSON.stringify({
      version: '2.0.0',
      databaseType: isPostgres() ? 'postgresql' : 'sqlite',
      portableData,
      customizations,
      sqliteBinary,
      uploads: uploadsMap,
    });
    const compressed = zlib.gzipSync(Buffer.from(payload, 'utf-8'), { level: 9 });
    const archiveData = encryptArchive(compressed);

    const manifest: BackupManifest = {
      manifestVersion: '2.0.0',
      systemVersion: '2.3.0',
      backupId,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      databaseType: isPostgres() ? 'postgresql' : 'sqlite',
      checksumSha256: crypto.createHash('sha256').update(archiveData).digest('hex'),
      fileSize: archiveData.length,
      recordCounts,
      includesUploads: Object.keys(uploadsMap).length > 0,
      includesCustomizations: true,
      createdByUser: user?.email || user?.username || 'SYSTEM_SCHEDULER',
    };

    const bundle = { manifest, formatVersion: 2, encrypted: true, signature: signBundle(manifest, archiveData), archiveData };
    fs.writeFileSync(targetFile, JSON.stringify(bundle), { encoding: 'utf-8', mode: 0o600 });

    // 1.7 Off-site copy
    const drConfig = await this.getConfig();
    let cloud: { success: boolean; message: string } | undefined;
    if (drConfig.enabled && drConfig.autoSyncCloud) {
      try {
        cloud = await this.syncToCloud(targetFile, filename, drConfig);
      } catch (e: any) {
        cloud = { success: false, message: e?.message || 'Off-site upload failed' };
        logger.error(`❌ [DR] Off-site copy of ${filename} FAILED: ${cloud.message}`);
        await this.notifyAdmins('Backup off-site copy failed', `${filename} was saved locally but could not be uploaded: ${cloud.message}`);
      }
      await this.recordSync(filename, cloud);
    }

    await this.pruneOldBackups(drConfig.retentionDays);
    return { manifest, filePath: targetFile, filename, cloud };
  }

  private static async recordSync(filename: string, result: { success: boolean; message: string }) {
    const key = 'disaster_recovery.sync_log';
    const existing = await prisma.systemSetting.findUnique({ where: { key } });
    let log: Record<string, any> = {};
    try {
      log = existing ? JSON.parse(existing.value) : {};
    } catch {
      log = {};
    }
    log[filename] = { ...result, at: new Date().toISOString() };
    const keys = Object.keys(log).sort().slice(-200);
    const trimmed = Object.fromEntries(keys.map((k) => [k, log[k]]));
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(trimmed), group: 'DISASTER_RECOVERY' },
      create: { key, value: JSON.stringify(trimmed), group: 'DISASTER_RECOVERY' },
    });
  }

  private static async notifyAdmins(title: string, message: string) {
    try {
      const admins = await prisma.user.findMany({ where: { isActive: true, role: { name: 'SUPER_ADMIN' } }, select: { id: true } });
      if (admins.length) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({ userId: a.id, type: 'SYSTEM', title, message, link: '/customization' })),
        });
      }
    } catch {
      /* ignore */
    }
  }

  /** Decodes and verifies an archive (v2 signed+encrypted, or legacy v1). */
  static openArchive(bundleData: string | Buffer): { manifest: any; payload: any; legacy: boolean } {
    let bundle: any;
    try {
      bundle = JSON.parse(Buffer.isBuffer(bundleData) ? bundleData.toString('utf-8') : bundleData);
    } catch {
      throw { statusCode: 400, message: 'Invalid backup file format or corrupt JSON.', code: 'INVALID_BACKUP_FILE' };
    }
    const { manifest } = bundle || {};
    if (!manifest) throw { statusCode: 400, message: 'Missing backup manifest.', code: 'CORRUPT_BACKUP' };

    let compressed: Buffer;
    let legacy = false;
    if (bundle.formatVersion === 2) {
      const expected = signBundle(manifest, bundle.archiveData || '');
      const given = String(bundle.signature || '');
      if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
        throw {
          statusCode: 400,
          message: 'Backup signature is invalid: the file was modified, or it was made with a different BACKUP_ENCRYPTION_KEY.',
          code: 'SIGNATURE_MISMATCH',
        };
      }
      try {
        compressed = decryptArchive(bundle.archiveData);
      } catch {
        throw { statusCode: 400, message: 'Unable to decrypt backup. Check BACKUP_ENCRYPTION_KEY.', code: 'DECRYPTION_ERROR' };
      }
    } else if (bundle.archiveDataGzipBase64) {
      legacy = true;
      compressed = Buffer.from(bundle.archiveDataGzipBase64, 'base64');
      const hash = crypto.createHash('sha256').update(compressed).digest('hex');
      if (hash !== manifest.checksumSha256) {
        throw { statusCode: 400, message: 'Checksum mismatch. Archive may be corrupted or tampered with.', code: 'CHECKSUM_MISMATCH' };
      }
    } else {
      throw { statusCode: 400, message: 'Missing archive data payload.', code: 'CORRUPT_BACKUP' };
    }

    try {
      return { manifest, payload: JSON.parse(zlib.gunzipSync(compressed).toString('utf-8')), legacy };
    } catch {
      throw { statusCode: 400, message: 'Failed to decompress archive data payload.', code: 'DECOMPRESSION_ERROR' };
    }
  }

  /**
   * 2. RESTORE COMPLETE SYSTEM FROM BACKUP ARCHIVE
   *  - SQLite: swaps the database file with the connection closed (old file kept as .bak_<time>).
   *  - PostgreSQL (or no binary in archive): replaces every table from the portable snapshot in one transaction.
   */
  static async restoreBackup(bundleData: string | Buffer): Promise<RestoreResult & { warnings?: string[] }> {
    const { manifest, payload, legacy } = this.openArchive(bundleData);
    const warnings: string[] = [];
    if (legacy) warnings.push('Legacy (unsigned, unencrypted) archive format. Create a new backup after restoring.');

    const recordsRestored: Record<string, number> = {};
    const { portableData, customizations, uploads, sqliteBinary } = payload;
    const dbPath = sqliteDbPath();
    let databaseRestored = false;

    if (sqliteBinary && dbPath && !isPostgres()) {
      const backupSqlite = Buffer.from(sqliteBinary, 'base64');
      if (backupSqlite.subarray(0, 15).toString('utf8') !== 'SQLite format 3') {
        throw { statusCode: 400, message: 'Archive does not contain a valid SQLite database.', code: 'CORRUPT_BACKUP' };
      }
      const safetyCopy = `${dbPath}.bak_${Date.now()}`;
      await prisma.$disconnect();
      try {
        if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, safetyCopy);
        for (const sfx of ['-wal', '-shm', '-journal']) if (fs.existsSync(dbPath + sfx)) fs.unlinkSync(dbPath + sfx);
        fs.writeFileSync(dbPath, backupSqlite);
      } finally {
        await prisma.$connect();
      }
      recordsRestored['database_binary'] = 1;
      warnings.push(`Previous database kept as ${path.basename(safetyCopy)}.`);
      databaseRestored = true;
    } else if (portableData && typeof portableData === 'object') {
      const counts = await this.restorePortable(portableData);
      Object.assign(recordsRestored, counts);
      databaseRestored = true;
    }
    if (!databaseRestored) {
      throw { statusCode: 400, message: 'Archive contains no database data that can be restored here.', code: 'NOTHING_TO_RESTORE' };
    }

    if (customizations) {
      await CustomizationExportImport.importAll(customizations);
      recordsRestored['customizations'] = 1;
    }

    if (uploads && typeof uploads === 'object') {
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      let fileCount = 0;
      let skipped = 0;
      for (const [relativePath, base64Data] of Object.entries(uploads)) {
        const fullPath = safeUploadPath(relativePath);
        if (!fullPath || typeof base64Data !== 'string') {
          skipped++;
          continue;
        }
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
        fileCount++;
      }
      recordsRestored['uploads'] = fileCount;
      if (skipped) warnings.push(`${skipped} file path(s) in the archive pointed outside the uploads folder and were ignored.`);
    }

    // Everyone must sign in again against the restored user table
    try {
      await prisma.user.updateMany({ data: { tokenVersion: { increment: 1 } } });
    } catch {
      /* column may not exist in very old archives */
    }

    const totalRecords = Object.values(recordsRestored).reduce((a, b) => a + b, 0);
    return {
      success: true,
      backupId: manifest.backupId,
      timestamp: new Date().toISOString(),
      recordsRestored,
      totalRecords,
      warnings,
      message: `System successfully restored from snapshot ${manifest.backupId}`,
    };
  }

  /** Replaces all table contents from the portable snapshot inside one transaction. */
  private static async restorePortable(portableData: Record<string, any[]>): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    await prisma.$transaction(
      async (tx: any) => {
        for (const t of [...TABLES].reverse()) {
          await tx[t.model].deleteMany({});
        }
        for (const t of TABLES) {
          let rows: any[] = Array.isArray(portableData[t.key]) ? portableData[t.key] : [];
          if (!rows.length) continue;
          if (t.selfRef) rows = parentsFirst(rows, t.selfRef);
          for (let i = 0; i < rows.length; i += 500) {
            await tx[t.model].createMany({ data: rows.slice(i, i + 500) });
          }
          counts[t.key] = rows.length;
        }
      },
      { timeout: 10 * 60 * 1000, maxWait: 60 * 1000 }
    );
    return counts;
  }

  /**
   * 3. LIST BACKUP HISTORY (with off-site sync status)
   */
  static async getHistory(): Promise<BackupHistoryItem[]> {
    this.ensureDir();
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.itam-backup'));
    const syncSetting = await prisma.systemSetting.findUnique({ where: { key: 'disaster_recovery.sync_log' } });
    let syncLog: Record<string, any> = {};
    try {
      syncLog = syncSetting ? JSON.parse(syncSetting.value) : {};
    } catch {
      syncLog = {};
    }
    const cfg = await this.getConfig();

    const history: BackupHistoryItem[] = [];
    for (const filename of files) {
      const fullPath = path.join(BACKUP_DIR, filename);
      const stat = fs.statSync(fullPath);
      let checksum = '';
      let recordCountTotal = 0;
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        checksum = parsed.manifest?.checksumSha256 || '';
        if (parsed.manifest?.recordCounts) {
          recordCountTotal = Object.values(parsed.manifest.recordCounts as Record<string, number>).reduce((a, b) => a + b, 0);
        }
      } catch {
        checksum = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
      }
      const sync = syncLog[filename];
      history.push({
        id: filename.replace('.itam-backup', ''),
        filename,
        timestamp: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        formattedSize: `${(stat.size / 1024 / 1024).toFixed(2)} MB`,
        checksumSha256: checksum,
        status: sync ? (sync.success ? 'CLOUD_SYNCED' : 'FAILED') : 'COMPLETED',
        cloudProvider: sync ? cfg.provider : undefined,
        cloudUrl: sync?.success ? sync.message : sync ? `Off-site copy failed: ${sync.message}` : undefined,
        recordCountTotal,
      });
    }
    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * 4. OFF-SITE COPY. Throws on failure (callers decide how to report it).
   */
  static async syncToCloud(filePath: string, filename: string, config: CloudStorageConfig): Promise<{ success: boolean; message: string; url?: string }> {
    if (!fs.existsSync(filePath)) throw new Error(`Local backup file not found: ${filePath}`);

    if (config.provider === 'LOCAL_NAS') {
      const targetDir = config.localPath?.trim() || path.resolve(process.cwd(), 'backups/remote_archive');
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const dest = path.join(targetDir, filename);
      fs.copyFileSync(filePath, dest);
      const sameDisk = path.resolve(targetDir).startsWith(path.resolve(process.cwd()));
      return {
        success: true,
        message: sameDisk
          ? `Copied to ${dest}. Warning: this folder is on the same server, so it does not protect against disk or server loss.`
          : `Backup copied to network share: ${dest}`,
        url: dest,
      };
    }

    const result = await CloudProviders.upload(config, filename, fs.readFileSync(filePath));
    if (result.newRefreshToken && result.newRefreshToken !== config.oneDriveRefreshToken) {
      await this.updateConfig({ oneDriveRefreshToken: result.newRefreshToken });
    }
    return result;
  }

  /**
   * 5. TEST OFF-SITE STORAGE (performs a real write)
   */
  static async testConnection(rawConfig: Partial<CloudStorageConfig>): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const startTime = Date.now();
    const config = await this.mergeWithStored(rawConfig || {});
    try {
      if (config.provider === 'LOCAL_NAS') {
        const targetDir = config.localPath?.trim() || path.resolve(process.cwd(), 'backups/remote_archive');
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        const testFile = path.join(targetDir, `.write_test_${Date.now()}.tmp`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        const sameDisk = path.resolve(targetDir).startsWith(path.resolve(process.cwd()));
        return {
          success: true,
          message: `Write access confirmed: ${targetDir}${sameDisk ? ' (warning: same server as the application — not an off-site copy)' : ''}`,
          latencyMs: Date.now() - startTime,
        };
      }
      const result = await CloudProviders.test(config);
      if (result.newRefreshToken && result.newRefreshToken !== config.oneDriveRefreshToken) {
        await this.updateConfig({ oneDriveRefreshToken: result.newRefreshToken });
      }
      return { success: true, message: result.message, latencyMs: Date.now() - startTime };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Connection test failed', latencyMs: Date.now() - startTime };
    }
  }

  /**
   * 6. PRUNE OLD BACKUPS ACCORDING TO RETENTION POLICY (always keeps the newest 3)
   */
  static async pruneOldBackups(retentionDays: number = 30): Promise<number> {
    this.ensureDir();
    const cutoff = Date.now() - Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.itam-backup'))
      .map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    let deletedCount = 0;
    files.slice(3).forEach(({ f, t }) => {
      if (t < cutoff) {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
        deletedCount++;
      }
    });
    if (deletedCount > 0) logger.info(`🧹 [DR RETENTION] Pruned ${deletedCount} backup archives older than ${retentionDays} days.`);
    return deletedCount;
  }
}
