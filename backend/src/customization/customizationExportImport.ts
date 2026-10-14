import { BrandingEngine } from './brandingEngine.js';
import { NumberingEngine } from './numberingEngine.js';
import { CustomFieldsEngine } from './customFieldsEngine.js';
import { WorkflowStatusEngine } from './workflowStatusEngine.js';
import { EmailTemplateEngine } from './emailTemplateEngine.js';
import { PdfTemplateEngine } from './pdfTemplateEngine.js';
import { FeatureFlagsEngine } from './featureFlagsEngine.js';
import { FullCustomizationBackup, CustomFieldEntity } from './types.js';

export class CustomizationExportImport {
  static async exportAll(): Promise<FullCustomizationBackup> {
    const [branding, numbering, customFields, statuses, emailTemplates, pdfTemplates, featureFlags] =
      await Promise.all([
        BrandingEngine.getBranding(),
        NumberingEngine.getAllSchemes(),
        CustomFieldsEngine.getAllFields(),
        WorkflowStatusEngine.getStatuses(),
        EmailTemplateEngine.getTemplates(),
        PdfTemplateEngine.getConfig(),
        FeatureFlagsEngine.getFlags(),
      ]);

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      branding,
      numbering,
      customFields,
      statuses,
      emailTemplates,
      pdfTemplates,
      featureFlags,
    };
  }

  static async importAll(data: FullCustomizationBackup): Promise<{ success: boolean; message: string }> {
    if (!data || typeof data !== 'object') {
      throw { statusCode: 400, message: 'Invalid configuration payload', code: 'INVALID_CONFIG' };
    }

    if (data.branding) {
      await BrandingEngine.updateBranding(data.branding);
    }

    if (data.numbering) {
      for (const [entity, scheme] of Object.entries(data.numbering)) {
        await NumberingEngine.updateScheme(entity as any, scheme);
      }
    }

    if (data.customFields) {
      for (const [entity, fields] of Object.entries(data.customFields)) {
        await CustomFieldsEngine.saveFields(entity as CustomFieldEntity, fields);
      }
    }

    if (data.statuses && Array.isArray(data.statuses)) {
      await WorkflowStatusEngine.saveStatuses(data.statuses);
    }

    if (data.emailTemplates) {
      for (const [trigger, tmpl] of Object.entries(data.emailTemplates)) {
        await EmailTemplateEngine.updateTemplate(trigger, tmpl);
      }
    }

    if (data.pdfTemplates) {
      await PdfTemplateEngine.updateConfig(data.pdfTemplates);
    }

    if (data.featureFlags) {
      await FeatureFlagsEngine.updateFlags(data.featureFlags);
    }

    return {
      success: true,
      message: 'Customization configuration successfully restored and activated',
    };
  }

  static async resetAllDefaults(): Promise<void> {
    await Promise.all([
      BrandingEngine.resetBranding(),
      WorkflowStatusEngine.resetStatuses(),
      PdfTemplateEngine.resetConfig(),
      FeatureFlagsEngine.resetFlags(),
      CustomFieldsEngine.resetFields(),
    ]);
  }
}
