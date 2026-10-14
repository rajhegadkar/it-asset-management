import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { DisasterRecoveryService } from './disasterRecoveryService.js';
import { logger } from '../config/logger.js';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

export class DisasterRecoveryController {
  /**
   * GET /api/v1/system/backup/config
   */
  static async getConfig(req: Request, res: Response) {
    try {
      const config = await DisasterRecoveryService.getConfig();
      return res.json({ success: true, data: config });
    } catch (err: any) {
      logger.error('Failed to get DR config:', err);
      return res.status(500).json({ error: err.message || 'Failed to fetch DR configuration' });
    }
  }

  /**
   * PUT /api/v1/system/backup/config
   */
  static async updateConfig(req: Request, res: Response) {
    try {
      const updated = await DisasterRecoveryService.updateConfig(req.body);
      return res.json({
        success: true,
        data: updated,
        message: 'Disaster recovery and backup settings updated successfully.',
      });
    } catch (err: any) {
      logger.error('Failed to update DR config:', err);
      return res.status(500).json({ error: err.message || 'Failed to update DR configuration' });
    }
  }

  /**
   * POST /api/v1/system/backup/test-cloud
   */
  static async testCloud(req: Request, res: Response) {
    try {
      const config = req.body;
      const result = await DisasterRecoveryService.testConnection(config);
      return res.json({
        success: result.success,
        message: result.message,
        latencyMs: result.latencyMs,
      });
    } catch (err: any) {
      logger.error('Cloud connection test failed:', err);
      return res.status(500).json({ success: false, message: err.message || 'Cloud connection failed' });
    }
  }

  /**
   * POST /api/v1/system/backup/create
   */
  static async createBackup(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const result = await DisasterRecoveryService.createBackup(user);
      return res.json({
        success: true,
        data: {
          manifest: result.manifest,
          filename: result.filename,
        },
        message: `Backup archive ${result.filename} created successfully.`,
      });
    } catch (err: any) {
      logger.error('Failed to create backup:', err);
      return res.status(500).json({ error: err.message || 'Failed to create backup archive' });
    }
  }

  /**
   * GET /api/v1/system/backup/history
   */
  static async getHistory(req: Request, res: Response) {
    try {
      const history = await DisasterRecoveryService.getHistory();
      return res.json({ success: true, data: history });
    } catch (err: any) {
      logger.error('Failed to get backup history:', err);
      return res.status(500).json({ error: err.message || 'Failed to retrieve backup history' });
    }
  }

  /**
   * GET /api/v1/system/backup/download/:filename
   */
  static async downloadBackup(req: Request, res: Response) {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(BACKUP_DIR, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Backup archive not found: ${filename}` });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.download(filePath, filename);
    } catch (err: any) {
      logger.error('Failed to download backup:', err);
      return res.status(500).json({ error: err.message || 'Failed to download backup archive' });
    }
  }

  /**
   * POST /api/v1/system/backup/restore
   */
  static async restoreBackup(req: Request, res: Response) {
    try {
      let dataBuffer: Buffer | string | null = null;

      if (req.file) {
        // Uploaded via form multipart
        dataBuffer = fs.readFileSync(req.file.path);
        // Clean up uploaded temp file
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      } else if (req.body && req.body.bundleData) {
        dataBuffer = req.body.bundleData;
      } else if (req.body && typeof req.body === 'object' && req.body.manifest) {
        dataBuffer = JSON.stringify(req.body);
      }

      if (!dataBuffer) {
        return res.status(400).json({ error: 'No backup file or data provided in request.' });
      }

      const result = await DisasterRecoveryService.restoreBackup(dataBuffer);
      return res.json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (err: any) {
      logger.error('Restore failed:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({
        error: err.message || 'Failed to restore system from backup archive',
        code: err.code || 'RESTORE_ERROR',
      });
    }
  }

  /**
   * DELETE /api/v1/system/backup/:filename
   */
  static async deleteBackup(req: Request, res: Response) {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(BACKUP_DIR, filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return res.json({ success: true, message: `Backup ${filename} deleted successfully.` });
      }
      return res.status(404).json({ error: `Backup archive not found: ${filename}` });
    } catch (err: any) {
      logger.error('Failed to delete backup:', err);
      return res.status(500).json({ error: err.message || 'Failed to delete backup archive' });
    }
  }
}
