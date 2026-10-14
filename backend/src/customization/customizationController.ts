import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import { BrandingEngine } from './brandingEngine.js';
import { CustomFieldsEngine } from './customFieldsEngine.js';
import { NumberingEngine } from './numberingEngine.js';
import { WorkflowStatusEngine } from './workflowStatusEngine.js';
import { EmailTemplateEngine } from './emailTemplateEngine.js';
import { PdfTemplateEngine } from './pdfTemplateEngine.js';
import { FeatureFlagsEngine } from './featureFlagsEngine.js';
import { CustomizationExportImport } from './customizationExportImport.js';
import { CustomFieldEntity } from './types.js';

export class CustomizationController {
  // --- Branding (Public GET, Super Admin PUT) ---
  static async getBranding(req: Request, res: Response, next: NextFunction) {
    try {
      const branding = await BrandingEngine.getBranding();
      return ApiResponse.success(res, branding, 'Branding configuration retrieved');
    } catch (e) {
      next(e);
    }
  }

  static async updateBranding(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await BrandingEngine.updateBranding(req.body);
      return ApiResponse.success(res, updated, 'Branding updated successfully');
    } catch (e) {
      next(e);
    }
  }

  // --- Custom Fields ---
  static async getFields(req: Request, res: Response, next: NextFunction) {
    try {
      const entity = req.params.entity.toUpperCase() as CustomFieldEntity;
      const fields = await CustomFieldsEngine.getFields(entity);
      return ApiResponse.success(res, fields, `Custom fields for ${entity}`);
    } catch (e) {
      next(e);
    }
  }

  static async getAllFields(req: Request, res: Response, next: NextFunction) {
    try {
      const fields = await CustomFieldsEngine.getAllFields();
      return ApiResponse.success(res, fields, 'All custom fields retrieved');
    } catch (e) {
      next(e);
    }
  }

  static async addField(req: Request, res: Response, next: NextFunction) {
    try {
      const entity = req.params.entity.toUpperCase() as CustomFieldEntity;
      const created = await CustomFieldsEngine.addField(entity, req.body);
      return ApiResponse.success(res, created, 'Custom field created successfully', 201);
    } catch (e) {
      next(e);
    }
  }

  static async updateField(req: Request, res: Response, next: NextFunction) {
    try {
      const entity = req.params.entity.toUpperCase() as CustomFieldEntity;
      const { fieldId } = req.params;
      const updated = await CustomFieldsEngine.updateField(entity, fieldId, req.body);
      return ApiResponse.success(res, updated, 'Custom field updated');
    } catch (e) {
      next(e);
    }
  }

  static async deleteField(req: Request, res: Response, next: NextFunction) {
    try {
      const entity = req.params.entity.toUpperCase() as CustomFieldEntity;
      const { fieldId } = req.params;
      await CustomFieldsEngine.deleteField(entity, fieldId);
      return ApiResponse.success(res, null, 'Custom field removed');
    } catch (e) {
      next(e);
    }
  }

  static async reorderFields(req: Request, res: Response, next: NextFunction) {
    try {
      const entity = req.params.entity.toUpperCase() as CustomFieldEntity;
      const { orderedIds } = req.body;
      const reordered = await CustomFieldsEngine.reorderFields(entity, orderedIds || []);
      return ApiResponse.success(res, reordered, 'Fields reordered');
    } catch (e) {
      next(e);
    }
  }

  // --- Numbering Schemes ---
  static async getNumberingSchemes(req: Request, res: Response, next: NextFunction) {
    try {
      const schemes = await NumberingEngine.getAllSchemes();
      return ApiResponse.success(res, schemes, 'Numbering schemes retrieved');
    } catch (e) {
      next(e);
    }
  }

  static async updateNumberingScheme(req: Request, res: Response, next: NextFunction) {
    try {
      const entity = req.params.entity.toUpperCase() as any;
      const updated = await NumberingEngine.updateScheme(entity, req.body);
      return ApiResponse.success(res, updated, 'Numbering scheme updated');
    } catch (e) {
      next(e);
    }
  }

  static async previewNumbering(req: Request, res: Response, next: NextFunction) {
    try {
      const { pattern, prefix, seqPadding, sampleSeq, categoryCode, departmentCode } = req.body;
      const preview = NumberingEngine.preview(
        pattern || '{PREFIX}-{CAT}-{SEQ:6}',
        prefix || 'IT',
        seqPadding || 6,
        sampleSeq || 42,
        { categoryCode, departmentCode }
      );
      return ApiResponse.success(res, { preview }, 'Number preview generated');
    } catch (e) {
      next(e);
    }
  }

  // --- Custom Statuses & Workflows ---
  static async getStatuses(req: Request, res: Response, next: NextFunction) {
    try {
      const statuses = await WorkflowStatusEngine.getStatuses();
      return ApiResponse.success(res, statuses, 'Asset statuses retrieved');
    } catch (e) {
      next(e);
    }
  }

  static async addStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const added = await WorkflowStatusEngine.addStatus(req.body);
      return ApiResponse.success(res, added, 'Status created successfully', 201);
    } catch (e) {
      next(e);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await WorkflowStatusEngine.updateStatus(id, req.body);
      return ApiResponse.success(res, updated, 'Status updated');
    } catch (e) {
      next(e);
    }
  }

  static async deleteStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await WorkflowStatusEngine.deleteStatus(id);
      return ApiResponse.success(res, null, 'Status removed');
    } catch (e) {
      next(e);
    }
  }

  // --- Email Templates ---
  static async getEmailTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await EmailTemplateEngine.getTemplates();
      return ApiResponse.success(res, templates, 'Email templates retrieved');
    } catch (e) {
      next(e);
    }
  }

  static async updateEmailTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { trigger } = req.params;
      const updated = await EmailTemplateEngine.updateTemplate(trigger.toUpperCase(), req.body);
      return ApiResponse.success(res, updated, 'Email template updated');
    } catch (e) {
      next(e);
    }
  }

  static async previewEmailTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { template, sampleData } = req.body;
      const rendered = EmailTemplateEngine.render(template, sampleData || {});
      return ApiResponse.success(res, rendered, 'Template preview rendered');
    } catch (e) {
      next(e);
    }
  }

  // --- PDF & Label Designer ---
  static async getPdfTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await PdfTemplateEngine.getConfig();
      return ApiResponse.success(res, config, 'PDF template configuration retrieved');
    } catch (e) {
      next(e);
    }
  }

  static async updatePdfTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await PdfTemplateEngine.updateConfig(req.body);
      return ApiResponse.success(res, updated, 'PDF template configuration updated');
    } catch (e) {
      next(e);
    }
  }

  // --- Feature Flags ---
  static async getFeatureFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const flags = await FeatureFlagsEngine.getFlags();
      return ApiResponse.success(res, flags, 'Feature flags retrieved');
    } catch (e) {
      next(e);
    }
  }

  static async updateFeatureFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await FeatureFlagsEngine.updateFlags(req.body);
      return ApiResponse.success(res, updated, 'Feature flags updated');
    } catch (e) {
      next(e);
    }
  }

  // --- Backup, Export & Import ---
  static async exportBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const backup = await CustomizationExportImport.exportAll();
      return ApiResponse.success(res, backup, 'Full customization backup exported');
    } catch (e) {
      next(e);
    }
  }

  static async importBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CustomizationExportImport.importAll(req.body);
      return ApiResponse.success(res, result, 'Customization backup restored successfully');
    } catch (e) {
      next(e);
    }
  }

  static async resetDefaults(req: Request, res: Response, next: NextFunction) {
    try {
      await CustomizationExportImport.resetAllDefaults();
      return ApiResponse.success(res, null, 'Customizations reset to factory defaults');
    } catch (e) {
      next(e);
    }
  }
}
