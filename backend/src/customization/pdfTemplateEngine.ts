import { prisma } from '../config/db.js';
import { PdfLabelConfig } from './types.js';

export const DEFAULT_PDF_LABEL_CONFIG: PdfLabelConfig = {
  labelWidthMm: 70,
  labelHeightMm: 36,
  labelsPerRow: 3,
  labelsPerCol: 8,
  barcodeType: 'CODE128',
  showLogo: true,
  headerText: 'PROPERTY OF IT OPERATIONS',
  includeFields: ['assetTag', 'serialNumber', 'model', 'category'],
  customHandoverTerms:
    '1. The employee acknowledges receipt of the designated corporate hardware equipment in good operating condition.\n' +
    '2. The equipment remains the exclusive property of the company and must be returned immediately upon separation or IT recall.\n' +
    '3. Unauthorized modification, hardware tampering, or personal subletting of the equipment is strictly prohibited.\n' +
    '4. In case of theft, loss, or hardware failure, the custodian must file an IT service incident within 24 hours.',
};

export class PdfTemplateEngine {
  private static KEY = 'customization.pdf_labels';

  static async getConfig(): Promise<PdfLabelConfig> {
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: this.KEY } });
      if (setting && setting.value) {
        return { ...DEFAULT_PDF_LABEL_CONFIG, ...JSON.parse(setting.value) };
      }
    } catch (e) {
      console.warn('Failed to load PDF template configuration:', e);
    }
    return DEFAULT_PDF_LABEL_CONFIG;
  }

  static async updateConfig(updates: Partial<PdfLabelConfig>): Promise<PdfLabelConfig> {
    const current = await this.getConfig();
    const updated: PdfLabelConfig = {
      ...current,
      ...updates,
    };

    await prisma.systemSetting.upsert({
      where: { key: this.KEY },
      update: {
        value: JSON.stringify(updated),
        group: 'BARCODE',
      },
      create: {
        key: this.KEY,
        value: JSON.stringify(updated),
        group: 'BARCODE',
      },
    });

    return updated;
  }

  static async resetConfig(): Promise<PdfLabelConfig> {
    await prisma.systemSetting.deleteMany({ where: { key: this.KEY } });
    return DEFAULT_PDF_LABEL_CONFIG;
  }
}
