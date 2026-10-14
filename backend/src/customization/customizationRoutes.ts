import { Router } from 'express';
import { CustomizationController } from './customizationController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';

export const customizationRouter = Router();

// Public / Unauthenticated Branding (allows login page and client themes to load early)
customizationRouter.get('/branding', CustomizationController.getBranding);

// All subsequent routes require authentication
customizationRouter.use(authenticate);

// Branding update (SUPER_ADMIN only)
customizationRouter.put('/branding', requireRole('SUPER_ADMIN'), CustomizationController.updateBranding);

// Custom Fields
customizationRouter.get('/fields', CustomizationController.getAllFields);
customizationRouter.get('/fields/:entity', CustomizationController.getFields);
customizationRouter.post('/fields/:entity', requireRole('SUPER_ADMIN'), CustomizationController.addField);
customizationRouter.put('/fields/:entity/:fieldId', requireRole('SUPER_ADMIN'), CustomizationController.updateField);
customizationRouter.delete('/fields/:entity/:fieldId', requireRole('SUPER_ADMIN'), CustomizationController.deleteField);
customizationRouter.post('/fields/:entity/reorder', requireRole('SUPER_ADMIN'), CustomizationController.reorderFields);

// Numbering Schemes
customizationRouter.get('/numbering', CustomizationController.getNumberingSchemes);
customizationRouter.put('/numbering/:entity', requireRole('SUPER_ADMIN'), CustomizationController.updateNumberingScheme);
customizationRouter.post('/numbering/preview', CustomizationController.previewNumbering);

// Custom Statuses
customizationRouter.get('/statuses', CustomizationController.getStatuses);
customizationRouter.post('/statuses', requireRole('SUPER_ADMIN'), CustomizationController.addStatus);
customizationRouter.put('/statuses/:id', requireRole('SUPER_ADMIN'), CustomizationController.updateStatus);
customizationRouter.delete('/statuses/:id', requireRole('SUPER_ADMIN'), CustomizationController.deleteStatus);

// Email Templates
customizationRouter.get('/email-templates', CustomizationController.getEmailTemplates);
customizationRouter.put('/email-templates/:trigger', requireRole('SUPER_ADMIN'), CustomizationController.updateEmailTemplate);
customizationRouter.post('/email-templates/preview', CustomizationController.previewEmailTemplate);

// PDF / Label Templates
customizationRouter.get('/pdf-templates', CustomizationController.getPdfTemplates);
customizationRouter.put('/pdf-templates', requireRole('SUPER_ADMIN'), CustomizationController.updatePdfTemplates);

// Feature Flags
customizationRouter.get('/features', CustomizationController.getFeatureFlags);
customizationRouter.put('/features', requireRole('SUPER_ADMIN'), CustomizationController.updateFeatureFlags);

// Backup, Export, Import & Reset (SUPER_ADMIN only)
customizationRouter.get('/backup/export', requireRole('SUPER_ADMIN'), CustomizationController.exportBackup);
customizationRouter.post('/backup/import', requireRole('SUPER_ADMIN'), CustomizationController.importBackup);
customizationRouter.post('/reset-defaults', requireRole('SUPER_ADMIN'), CustomizationController.resetDefaults);
