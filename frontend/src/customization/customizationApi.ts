import { api } from '../api/client.js';
import {
  BrandingConfig,
  CustomFieldDefinition,
  CustomFieldEntity,
  NumberingSchemeConfig,
  CustomStatusConfig,
  EmailTemplateConfig,
  PdfLabelConfig,
  FeatureFlagsConfig,
  FullCustomizationBackup,
} from './types.js';

export const customizationApi = {
  // Branding
  getBranding: async (): Promise<BrandingConfig> => {
    const res = await api.get('/customization/branding');
    return res.data.data;
  },
  updateBranding: async (data: Partial<BrandingConfig>): Promise<BrandingConfig> => {
    const res = await api.put('/customization/branding', data);
    return res.data.data;
  },

  // Custom Fields
  getAllFields: async (): Promise<Record<CustomFieldEntity, CustomFieldDefinition[]>> => {
    const res = await api.get('/customization/fields');
    return res.data.data;
  },
  getFields: async (entity: CustomFieldEntity): Promise<CustomFieldDefinition[]> => {
    const res = await api.get(`/customization/fields/${entity}`);
    return res.data.data;
  },
  addField: async (entity: CustomFieldEntity, field: Partial<CustomFieldDefinition>): Promise<CustomFieldDefinition> => {
    const res = await api.post(`/customization/fields/${entity}`, field);
    return res.data.data;
  },
  updateField: async (entity: CustomFieldEntity, fieldId: string, field: Partial<CustomFieldDefinition>): Promise<CustomFieldDefinition> => {
    const res = await api.put(`/customization/fields/${entity}/${fieldId}`, field);
    return res.data.data;
  },
  deleteField: async (entity: CustomFieldEntity, fieldId: string): Promise<void> => {
    await api.delete(`/customization/fields/${entity}/${fieldId}`);
  },
  reorderFields: async (entity: CustomFieldEntity, orderedIds: string[]): Promise<CustomFieldDefinition[]> => {
    const res = await api.post(`/customization/fields/${entity}/reorder`, { orderedIds });
    return res.data.data;
  },

  // Numbering Schemes
  getNumberingSchemes: async (): Promise<Record<string, NumberingSchemeConfig>> => {
    const res = await api.get('/customization/numbering');
    return res.data.data;
  },
  updateNumberingScheme: async (entity: string, scheme: Partial<NumberingSchemeConfig>): Promise<NumberingSchemeConfig> => {
    const res = await api.put(`/customization/numbering/${entity}`, scheme);
    return res.data.data;
  },
  previewNumbering: async (params: {
    pattern: string;
    prefix: string;
    seqPadding: number;
    sampleSeq?: number;
    categoryCode?: string;
    departmentCode?: string;
  }): Promise<string> => {
    const res = await api.post('/customization/numbering/preview', params);
    return res.data.data.preview;
  },

  // Custom Statuses
  getStatuses: async (): Promise<CustomStatusConfig[]> => {
    const res = await api.get('/customization/statuses');
    return res.data.data;
  },
  addStatus: async (status: Partial<CustomStatusConfig>): Promise<CustomStatusConfig> => {
    const res = await api.post('/customization/statuses', status);
    return res.data.data;
  },
  updateStatus: async (id: string, status: Partial<CustomStatusConfig>): Promise<CustomStatusConfig> => {
    const res = await api.put(`/customization/statuses/${id}`, status);
    return res.data.data;
  },
  deleteStatus: async (id: string): Promise<void> => {
    await api.delete(`/customization/statuses/${id}`);
  },

  // Email Templates
  getEmailTemplates: async (): Promise<Record<string, EmailTemplateConfig>> => {
    const res = await api.get('/customization/email-templates');
    return res.data.data;
  },
  updateEmailTemplate: async (trigger: string, tmpl: Partial<EmailTemplateConfig>): Promise<EmailTemplateConfig> => {
    const res = await api.put(`/customization/email-templates/${trigger}`, tmpl);
    return res.data.data;
  },
  previewEmailTemplate: async (template: EmailTemplateConfig, sampleData?: Record<string, any>): Promise<{ subject: string; html: string }> => {
    const res = await api.post('/customization/email-templates/preview', { template, sampleData });
    return res.data.data;
  },

  // PDF Templates
  getPdfTemplates: async (): Promise<PdfLabelConfig> => {
    const res = await api.get('/customization/pdf-templates');
    return res.data.data;
  },
  updatePdfTemplates: async (config: Partial<PdfLabelConfig>): Promise<PdfLabelConfig> => {
    const res = await api.put('/customization/pdf-templates', config);
    return res.data.data;
  },

  // Feature Flags
  getFeatureFlags: async (): Promise<FeatureFlagsConfig> => {
    const res = await api.get('/customization/features');
    return res.data.data;
  },
  updateFeatureFlags: async (flags: Partial<FeatureFlagsConfig>): Promise<FeatureFlagsConfig> => {
    const res = await api.put('/customization/features', flags);
    return res.data.data;
  },

  // Backup & Reset
  exportBackup: async (): Promise<FullCustomizationBackup> => {
    const res = await api.get('/customization/backup/export');
    return res.data.data;
  },
  importBackup: async (backup: FullCustomizationBackup): Promise<{ success: boolean; message: string }> => {
    const res = await api.post('/customization/backup/import', backup);
    return res.data.data;
  },
  resetDefaults: async (): Promise<void> => {
    await api.post('/customization/reset-defaults');
  },
};
