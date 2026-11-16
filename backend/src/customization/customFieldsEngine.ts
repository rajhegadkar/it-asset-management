import { prisma } from '../config/db.js';
import { CustomFieldDefinition, CustomFieldEntity } from './types.js';

export const DEFAULT_CUSTOM_FIELDS: Record<CustomFieldEntity, CustomFieldDefinition[]> = {
  ASSET: [
    {
      id: 'field-ast-1',
      entity: 'ASSET',
      name: 'screenSize',
      label: 'Screen Size (Inches)',
      type: 'text',
      required: false,
      placeholder: 'e.g. 15.6" or 27"',
      order: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'field-ast-2',
      entity: 'ASSET',
      name: 'secondaryMac',
      label: 'Secondary / Wi-Fi MAC',
      type: 'text',
      required: false,
      placeholder: '00:1B:44:11:3A:B7',
      order: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'field-ast-3',
      entity: 'ASSET',
      name: 'criticalityLevel',
      label: 'Business Criticality',
      type: 'select',
      required: false,
      defaultValue: 'TIER_3_STANDARD_OFFICE',
      options: ['TIER_1_MISSION_CRITICAL', 'TIER_2_BUSINESS_IMPORTANT', 'TIER_3_STANDARD_OFFICE', 'TIER_4_LOW_PRIORITY'],
      order: 3,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'field-ast-4',
      entity: 'ASSET',
      name: 'backupRequired',
      label: 'Automated Cloud Backup Enabled',
      type: 'checkbox',
      required: false,
      defaultValue: true,
      order: 4,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  EMPLOYEE: [
    {
      id: 'field-emp-1',
      entity: 'EMPLOYEE',
      name: 'deskCubicle',
      label: 'Desk / Cubicle Number',
      type: 'text',
      required: false,
      placeholder: 'Floor 3, Cube 314',
      order: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'field-emp-2',
      entity: 'EMPLOYEE',
      name: 'slackHandle',
      label: 'Slack / Teams Handle',
      type: 'text',
      required: false,
      placeholder: '@john.doe',
      order: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  TICKET: [
    {
      id: 'field-tkt-1',
      entity: 'TICKET',
      name: 'businessImpact',
      label: 'Immediate Business Impact',
      type: 'select',
      required: false,
      defaultValue: 'SINGLE_USER',
      options: ['SINGLE_USER', 'WORKGROUP_DEPT', 'EXECUTIVE', 'COMPANY_WIDE_OUTAGE'],
      order: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  MAINTENANCE: [
    {
      id: 'field-mnt-1',
      entity: 'MAINTENANCE',
      name: 'rmaNumber',
      label: 'Vendor RMA Tracking Code',
      type: 'text',
      required: false,
      placeholder: 'RMA-2026-99482',
      order: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  LICENSE: [],
  CONSUMABLE: [],
};

/**
 * A select field's default must be one of its options. Older installs shipped
 * criticalityLevel with default "TIER_3" while the options are "TIER_3_STANDARD_OFFICE" etc.,
 * which made every edit of an asset without that value fail validation.
 * Returns the repaired default (closest option by prefix) or undefined.
 */
export function repairSelectDefault(f: Partial<CustomFieldDefinition>): { changed: boolean; value: any } {
  const opts = Array.isArray((f as any).options) ? ((f as any).options as string[]) : [];
  const d = (f as any).defaultValue;
  if (!['select', 'multiselect'].includes(String(f.type)) || !opts.length || d === undefined || d === null || d === '') return { changed: false, value: d };
  if (opts.includes(String(d))) return { changed: false, value: d };
  const match = opts.find((o) => o.toUpperCase().startsWith(String(d).toUpperCase()));
  return { changed: true, value: match };
}

function assertValidDefault(f: Partial<CustomFieldDefinition>) {
  const opts = Array.isArray((f as any).options) ? ((f as any).options as string[]) : [];
  const d = (f as any).defaultValue;
  if (['select', 'multiselect'].includes(String(f.type)) && opts.length && d !== undefined && d !== null && d !== '' && !opts.includes(String(d))) {
    throw { statusCode: 400, message: `Default value "${d}" must be one of the options: ${opts.join(', ')}`, code: 'INVALID_DEFAULT' };
  }
}

export class CustomFieldsEngine {
  private static getKey(entity: CustomFieldEntity): string {
    return `customization.fields.${entity.toLowerCase()}`;
  }

  static async getFields(entity: CustomFieldEntity): Promise<CustomFieldDefinition[]> {
    try {
      const key = this.getKey(entity);
      const setting = await prisma.systemSetting.findUnique({ where: { key } });
      if (setting && setting.value) {
        const fields: CustomFieldDefinition[] = JSON.parse(setting.value);
        // one-time self-repair of invalid select defaults (see repairSelectDefault)
        let repaired = false;
        for (const f of fields) {
          const r = repairSelectDefault(f);
          if (r.changed) {
            repaired = true;
            if (r.value === undefined) delete (f as any).defaultValue;
            else (f as any).defaultValue = r.value;
          }
        }
        if (repaired) await this.saveFields(entity, fields);
        return fields;
      }
    } catch (e) {
      console.warn(`Failed to fetch custom fields for ${entity}:`, e);
    }
    return DEFAULT_CUSTOM_FIELDS[entity] || [];
  }

  static async getAllFields(): Promise<Record<CustomFieldEntity, CustomFieldDefinition[]>> {
    const entities: CustomFieldEntity[] = ['ASSET', 'EMPLOYEE', 'TICKET', 'MAINTENANCE', 'LICENSE', 'CONSUMABLE'];
    const result: Record<string, CustomFieldDefinition[]> = {};

    for (const ent of entities) {
      result[ent] = await this.getFields(ent);
    }
    return result as Record<CustomFieldEntity, CustomFieldDefinition[]>;
  }

  static async addField(entity: CustomFieldEntity, fieldData: Omit<CustomFieldDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomFieldDefinition> {
    const current = await this.getFields(entity);

    // Validate unique field name
    const cleanName = fieldData.name.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanName) {
      throw { statusCode: 400, message: 'Field name must contain alphanumeric characters', code: 'INVALID_FIELD_NAME' };
    }
    if (current.some(f => f.name.toLowerCase() === cleanName.toLowerCase())) {
      throw { statusCode: 409, message: `Field with name "${cleanName}" already exists for ${entity}`, code: 'DUPLICATE_FIELD' };
    }

    assertValidDefault(fieldData as any);
    const newField: CustomFieldDefinition = {
      ...fieldData,
      id: `field-${entity.toLowerCase()}-${Date.now()}`,
      name: cleanName,
      label: fieldData.label.trim(),
      order: current.length + 1,
      isActive: fieldData.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [...current, newField];
    await this.saveFields(entity, updated);
    return newField;
  }

  static async updateField(entity: CustomFieldEntity, fieldId: string, updates: Partial<CustomFieldDefinition>): Promise<CustomFieldDefinition> {
    const current = await this.getFields(entity);
    const index = current.findIndex(f => f.id === fieldId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Custom field not found', code: 'NOT_FOUND' };
    }

    const updatedField = {
      ...current[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    assertValidDefault(updatedField);

    current[index] = updatedField;
    await this.saveFields(entity, current);
    return updatedField;
  }

  static async deleteField(entity: CustomFieldEntity, fieldId: string): Promise<boolean> {
    const current = await this.getFields(entity);
    const filtered = current.filter(f => f.id !== fieldId);
    if (filtered.length === current.length) {
      throw { statusCode: 404, message: 'Custom field not found', code: 'NOT_FOUND' };
    }

    await this.saveFields(entity, filtered);
    return true;
  }

  static async reorderFields(entity: CustomFieldEntity, orderedIds: string[]): Promise<CustomFieldDefinition[]> {
    const current = await this.getFields(entity);
    const fieldMap = new Map(current.map(f => [f.id, f]));

    const reordered: CustomFieldDefinition[] = [];
    orderedIds.forEach((id, idx) => {
      const field = fieldMap.get(id);
      if (field) {
        field.order = idx + 1;
        reordered.push(field);
        fieldMap.delete(id);
      }
    });

    // Append any omitted fields
    fieldMap.forEach(f => {
      f.order = reordered.length + 1;
      reordered.push(f);
    });

    await this.saveFields(entity, reordered);
    return reordered;
  }

  static async saveFields(entity: CustomFieldEntity, fields: CustomFieldDefinition[]): Promise<void> {
    const key = this.getKey(entity);
    await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(fields),
        group: 'CUSTOM_FIELDS',
      },
      create: {
        key,
        value: JSON.stringify(fields),
        group: 'CUSTOM_FIELDS',
      },
    });
  }

  static async resetFields(entity?: CustomFieldEntity): Promise<void> {
    if (entity) {
      const key = this.getKey(entity);
      await prisma.systemSetting.deleteMany({ where: { key } });
    } else {
      const entities: CustomFieldEntity[] = ['ASSET', 'EMPLOYEE', 'TICKET', 'MAINTENANCE', 'LICENSE', 'CONSUMABLE'];
      for (const ent of entities) {
        await prisma.systemSetting.deleteMany({ where: { key: this.getKey(ent) } });
      }
    }
  }
}
