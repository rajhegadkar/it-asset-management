import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { DisasterRecoveryController } from './disasterRecoveryController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';

const tempUploadDir = path.resolve(process.cwd(), 'backups/temp_upload');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const backupUpload = multer({
  dest: tempUploadDir,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max backup archive
  },
});

export const disasterRecoveryRouter = Router();

// Only SUPER_ADMIN can configure or execute Disaster Recovery operations
disasterRecoveryRouter.use(authenticate);
disasterRecoveryRouter.use(requireRole('SUPER_ADMIN'));

disasterRecoveryRouter.get('/config', DisasterRecoveryController.getConfig);
disasterRecoveryRouter.put('/config', DisasterRecoveryController.updateConfig);
disasterRecoveryRouter.post('/test-cloud', DisasterRecoveryController.testCloud);

disasterRecoveryRouter.post('/create', DisasterRecoveryController.createBackup);
disasterRecoveryRouter.get('/history', DisasterRecoveryController.getHistory);
disasterRecoveryRouter.get('/list', DisasterRecoveryController.getHistory);
disasterRecoveryRouter.get('/download/:filename', DisasterRecoveryController.downloadBackup);
disasterRecoveryRouter.post('/restore', backupUpload.single('file'), DisasterRecoveryController.restoreBackup);
disasterRecoveryRouter.delete('/:filename', DisasterRecoveryController.deleteBackup);
