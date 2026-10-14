import { prisma } from '../config/db.js';
import { CustomStatusConfig } from './types.js';

export const DEFAULT_STATUSES: CustomStatusConfig[] = [
  {
    id: 'status-avail',
    code: 'AVAILABLE',
    name: 'Available in Stock',
    category: 'IN_STOCK',
    color: 'emerald',
    hexColor: '#10b981',
    description: 'Hardware verified, sanitized, and ready for deployment',
    isDefault: true,
    allowAllocation: true,
    isArchived: false,
  },
  {
    id: 'status-asgd',
    code: 'ASSIGNED',
    name: 'Assigned / Active Deployment',
    category: 'IN_USE',
    color: 'blue',
    hexColor: '#3b82f6',
    description: 'Currently deployed in custody of an active employee',
    isDefault: true,
    allowAllocation: false,
    isArchived: false,
  },
  {
    id: 'status-maint',
    code: 'UNDER_MAINTENANCE',
    name: 'Under Maintenance / Repair',
    category: 'MAINTENANCE',
    color: 'amber',
    hexColor: '#f59e0b',
    description: 'Hardware servicing, RMA diagnostics, or hardware upgrade',
    isDefault: true,
    allowAllocation: false,
    isArchived: false,
  },
  {
    id: 'status-loan',
    code: 'LOANER_IN_FIELD',
    name: 'Temporary Loaner / Travel Kit',
    category: 'IN_USE',
    color: 'purple',
    hexColor: '#8b5cf6',
    description: 'Assigned for short-term project, conference, or loaner replacement',
    isDefault: false,
    allowAllocation: false,
    isArchived: false,
  },
  {
    id: 'status-ret',
    code: 'RETIRED',
    name: 'Retired / End-of-Life',
    category: 'DISPOSED',
    color: 'slate',
    hexColor: '#64748b',
    description: 'Decommissioned from corporate service, awaiting wipe or disposal',
    isDefault: true,
    allowAllocation: false,
    isArchived: false,
  },
  {
    id: 'status-disp',
    code: 'DISPOSED',
    name: 'Disposed / Recycled / Sold',
    category: 'DISPOSED',
    color: 'rose',
    hexColor: '#f43f5e',
    description: 'Permanently removed from organization through e-waste or sale',
    isDefault: true,
    allowAllocation: false,
    isArchived: false,
  },
];

export class WorkflowStatusEngine {
  private static KEY = 'customization.statuses';

  static async getStatuses(): Promise<CustomStatusConfig[]> {
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: this.KEY } });
      if (setting && setting.value) {
        return JSON.parse(setting.value);
      }
    } catch (e) {
      console.warn('Failed to fetch custom statuses:', e);
    }
    return DEFAULT_STATUSES;
  }

  static async addStatus(statusData: Omit<CustomStatusConfig, 'id' | 'isDefault' | 'isArchived'>): Promise<CustomStatusConfig> {
    const current = await this.getStatuses();
    const cleanCode = statusData.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    if (current.some(s => s.code === cleanCode)) {
      throw { statusCode: 409, message: `Status code "${cleanCode}" already exists`, code: 'DUPLICATE_STATUS' };
    }

    const newStatus: CustomStatusConfig = {
      ...statusData,
      id: `status-${Date.now()}`,
      code: cleanCode,
      name: statusData.name.trim(),
      isDefault: false,
      isArchived: false,
    };

    const updated = [...current, newStatus];
    await this.saveStatuses(updated);
    return newStatus;
  }

  static async updateStatus(id: string, updates: Partial<CustomStatusConfig>): Promise<CustomStatusConfig> {
    const current = await this.getStatuses();
    const index = current.findIndex(s => s.id === id);
    if (index === -1) {
      throw { statusCode: 404, message: 'Status definition not found', code: 'NOT_FOUND' };
    }

    const updatedStatus = {
      ...current[index],
      ...updates,
      code: current[index].isDefault ? current[index].code : (updates.code || current[index].code),
    };

    current[index] = updatedStatus;
    await this.saveStatuses(current);
    return updatedStatus;
  }

  static async deleteStatus(id: string): Promise<boolean> {
    const current = await this.getStatuses();
    const target = current.find(s => s.id === id);
    if (!target) {
      throw { statusCode: 404, message: 'Status definition not found', code: 'NOT_FOUND' };
    }
    if (target.isDefault) {
      throw { statusCode: 400, message: 'Cannot delete built-in system default status', code: 'CANNOT_DELETE_DEFAULT' };
    }

    const filtered = current.filter(s => s.id !== id);
    await this.saveStatuses(filtered);
    return true;
  }

  static async saveStatuses(statuses: CustomStatusConfig[]): Promise<void> {
    await prisma.systemSetting.upsert({
      where: { key: this.KEY },
      update: {
        value: JSON.stringify(statuses),
        group: 'WORKFLOW',
      },
      create: {
        key: this.KEY,
        value: JSON.stringify(statuses),
        group: 'WORKFLOW',
      },
    });
  }

  static async resetStatuses(): Promise<CustomStatusConfig[]> {
    await prisma.systemSetting.deleteMany({ where: { key: this.KEY } });
    return DEFAULT_STATUSES;
  }
}
