import React, { useEffect, useState } from 'react';
import { CustomFieldDefinition, CustomFieldEntity } from './types.js';
import { customizationApi } from './customizationApi.js';
import { useBranding } from './BrandingContext.js';

interface CustomFieldRendererProps {
  entity: CustomFieldEntity;
  values: Record<string, any>;
  onChange: (newValues: Record<string, any>) => void;
  categoryId?: string;
  disabled?: boolean;
}

export const CustomFieldRenderer: React.FC<CustomFieldRendererProps> = ({
  entity,
  values,
  onChange,
  categoryId,
  disabled = false,
}) => {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const { branding } = useBranding();

  useEffect(() => {
    let isMounted = true;
    const loadFields = async () => {
      try {
        setLoading(true);
        const data = await customizationApi.getFields(entity);
        if (isMounted) {
          // Filter by active and category if specified
          const activeFields = data
            .filter((f) => f.isActive)
            .filter((f) => !f.categoryId || !categoryId || f.categoryId === categoryId)
            .sort((a, b) => a.order - b.order);
          setFields(activeFields);

          // Seed default values if current values are missing them
          const seeded = { ...values };
          let changed = false;
          activeFields.forEach((f) => {
            if (seeded[f.name] === undefined && f.defaultValue !== undefined && f.defaultValue !== '') {
              seeded[f.name] = f.defaultValue;
              changed = true;
            }
          });
          if (changed) {
            onChange(seeded);
          }
        }
      } catch (e) {
        console.warn(`Failed to load custom fields for ${entity}:`, e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadFields();
    return () => {
      isMounted = false;
    };
  }, [entity, categoryId]);

  if (loading) {
    return <div className="text-xs text-slate-400 italic py-2">Loading custom specification fields...</div>;
  }

  if (fields.length === 0) {
    return null;
  }

  const handleFieldChange = (name: string, val: any) => {
    onChange({
      ...values,
      [name]: val,
    });
  };

  return (
    <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Custom Specification Fields ({fields.length})
        </h4>
        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
          Custom Schema
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {fields.map((f) => {
          const val = values[f.name] !== undefined ? values[f.name] : f.defaultValue || '';

          return (
            <div key={f.id} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {f.label} {f.required && <span className="text-rose-500">*</span>}
              </label>

              {f.type === 'text' && (
                <input
                  type="text"
                  disabled={disabled}
                  required={f.required}
                  value={val}
                  onChange={(e) => handleFieldChange(f.name, e.target.value)}
                  placeholder={f.placeholder || ''}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              )}

              {f.type === 'number' && (
                <input
                  type="number"
                  disabled={disabled}
                  required={f.required}
                  value={val}
                  onChange={(e) => handleFieldChange(f.name, e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={f.placeholder || '0'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              )}

              {f.type === 'currency' && (
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">{branding.currencySymbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={disabled}
                    required={f.required}
                    value={val}
                    onChange={(e) => handleFieldChange(f.name, e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={f.placeholder || '0.00'}
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              )}

              {f.type === 'date' && (
                <input
                  type="date"
                  disabled={disabled}
                  required={f.required}
                  value={val}
                  onChange={(e) => handleFieldChange(f.name, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              )}

              {f.type === 'email' && (
                <input
                  type="email"
                  disabled={disabled}
                  required={f.required}
                  value={val}
                  onChange={(e) => handleFieldChange(f.name, e.target.value)}
                  placeholder={f.placeholder || 'name@domain.com'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              )}

              {f.type === 'url' && (
                <input
                  type="url"
                  disabled={disabled}
                  required={f.required}
                  value={val}
                  onChange={(e) => handleFieldChange(f.name, e.target.value)}
                  placeholder={f.placeholder || 'https://...'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              )}

              {f.type === 'select' && (
                <select
                  disabled={disabled}
                  required={f.required}
                  value={val}
                  onChange={(e) => handleFieldChange(f.name, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- Select option --</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              )}

              {f.type === 'checkbox' && (
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={!!val}
                    onChange={(e) => handleFieldChange(f.name, e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400 text-xs">
                    {f.helpText || f.label}
                  </span>
                </div>
              )}

              {f.type === 'textarea' && (
                <textarea
                  rows={2}
                  disabled={disabled}
                  required={f.required}
                  value={val}
                  onChange={(e) => handleFieldChange(f.name, e.target.value)}
                  placeholder={f.placeholder || ''}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              )}

              {f.helpText && f.type !== 'checkbox' && (
                <span className="text-[10px] text-slate-400 mt-0.5 block">{f.helpText}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
