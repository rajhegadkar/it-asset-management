import { prisma } from '../config/db.js';
import { FeatureFlagsConfig } from './types.js';

export const DEFAULT_FEATURE_FLAGS: FeatureFlagsConfig = {
  enableSamLicenses: true,
  enableConsumables: true,
  enableEmployeePortal: true,
  enableMaintenance: true,
  enableCameraScanner: true,
  enableHardwareScanner: true,
  enableDigitalSignature: true,
  require2faAllAdmins: false,
  maintenanceMode: false,
  maintenanceMessage: 'System is temporarily undergoing scheduled IT maintenance. Please check back shortly.',
};

export class FeatureFlagsEngine {
  private static KEY = 'customization.features';

  static async getFlags(): Promise<FeatureFlagsConfig> {
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: this.KEY } });
      if (setting && setting.value) {
        return { ...DEFAULT_FEATURE_FLAGS, ...JSON.parse(setting.value) };
      }
    } catch (e) {
      console.warn('Failed to load feature flags:', e);
    }
    return DEFAULT_FEATURE_FLAGS;
  }

  static async updateFlags(updates: Partial<FeatureFlagsConfig>): Promise<FeatureFlagsConfig> {
    const current = await this.getFlags();
    const updated: FeatureFlagsConfig = {
      ...current,
      ...updates,
    };

    await prisma.systemSetting.upsert({
      where: { key: this.KEY },
      update: {
        value: JSON.stringify(updated),
        group: 'SECURITY',
      },
      create: {
        key: this.KEY,
        value: JSON.stringify(updated),
        group: 'SECURITY',
      },
    });

    return updated;
  }

  static async resetFlags(): Promise<FeatureFlagsConfig> {
    await prisma.systemSetting.deleteMany({ where: { key: this.KEY } });
    return DEFAULT_FEATURE_FLAGS;
  }
}
