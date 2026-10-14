import React, { useEffect, useState } from 'react';
import { CustomFieldDefinition, CustomFieldEntity } from './types.js';
import { customizationApi } from './customizationApi.js';
import { useBranding } from './BrandingContext.js';
import { CustomFieldRenderer } from './CustomFieldRenderer.js';
import { Edit2, Save, X, CheckCircle2, Sliders } from 'lucide-react';

interface CustomFieldDisplayProps {
  customFields?: string | Record<string, any> | null;
  entity: CustomFieldEntity;
  categoryId?: string;
  onSave?: (updatedFields: Record<string, any>) => Promise<void>;
  title?: string;
}

export const CustomFieldDisplay: React.FC<CustomFieldDisplayProps> = ({
  customFields,
  entity,
  categoryId,
  onSave,
  title,
}) => {
  const [fieldDefs, setFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const { formatCurrency, formatDate } = useBranding();

  const fetchDefs = async () => {
    try {
      setLoading(true);
      const data = await customizationApi.getFields(entity);
      setFieldDefs(data || []);
    } catch (e) {
      console.warn(`Failed to fetch custom field definitions for ${entity}:`, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefs();
  }, [entity]);

  // Parse existing customFields
  let parsed: Record<string, any> = {};
  try {
    if (customFields) {
      parsed = typeof customFields === 'string' ? JSON.parse(customFields) : { ...customFields };
    }
  } catch {
    parsed = {};
  }

  // Active fields matching category
  const activeDefs = fieldDefs
    .filter((f) => f.isActive)
    .filter((f) => !f.categoryId || !categoryId || f.categoryId === categoryId)
    .sort((a, b) => a.order - b.order);

  // Extra keys in parsed that aren't defined in activeDefs
  const definedKeys = new Set(activeDefs.map((f) => f.name));
  const extraKeys = Object.keys(parsed).filter(
    (k) => !definedKeys.has(k) && parsed[k] !== undefined && parsed[k] !== null && parsed[k] !== ''
  );

  const totalFieldsCount = activeDefs.length + extraKeys.length;

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm text-xs text-slate-400 italic">
        Loading custom specification attributes...
      </div>
    );
  }

  // If no fields defined and no values stored
  if (totalFieldsCount === 0 && !onSave) {
    return null;
  }

  const handleStartEdit = () => {
    // Seed edit values from parsed + defaults
    const initial: Record<string, any> = { ...parsed };
    activeDefs.forEach((f) => {
      if (initial[f.name] === undefined && f.defaultValue !== undefined) {
        initial[f.name] = f.defaultValue;
      }
    });
    setEditValues(initial);
    setIsEditing(true);
    setSaveMessage(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveMessage(null);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaveLoading(true);
    try {
      await onSave(editValues);
      setSaveMessage('Custom attributes updated successfully');
      setTimeout(() => setSaveMessage(null), 3000);
      setIsEditing(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update custom attributes');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {title || `Custom Specification Attributes (${totalFieldsCount})`}
          </h4>
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
            Enterprise Schema
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {saveMessage && (
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saveMessage}</span>
            </span>
          )}

          {onSave && !isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 text-slate-700 dark:text-slate-200 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit Attributes</span>
            </button>
          )}
        </div>
      </div>

      {/* Editing Mode */}
      {isEditing ? (
        <div className="space-y-4">
          <CustomFieldRenderer
            entity={entity}
            values={editValues}
            onChange={setEditValues}
            categoryId={categoryId}
          />

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={saveLoading}
              onClick={handleCancelEdit}
              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              disabled={saveLoading}
              onClick={handleSave}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveLoading ? 'Saving...' : 'Save Attributes'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* View Mode: Displays ALL configured custom fields */
        <div>
          {totalFieldsCount === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              No custom attributes configured for this entity. You can configure custom fields in the Customization Center.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              {/* Defined active fields from Customization schema */}
              {activeDefs.map((def) => {
                const rawVal = parsed[def.name];
                const hasValue = rawVal !== undefined && rawVal !== null && rawVal !== '';

                let renderedVal: React.ReactNode = (
                  <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                    {def.defaultValue !== undefined && def.defaultValue !== ''
                      ? `${def.defaultValue} (Default)`
                      : '— Not specified'}
                  </span>
                );

                if (hasValue) {
                  if (def.type === 'checkbox') {
                    renderedVal = (
                      <span className={`font-semibold ${rawVal ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {rawVal ? '✓ Yes (Enabled)' : '✕ No (Disabled)'}
                      </span>
                    );
                  } else if (def.type === 'currency') {
                    renderedVal = (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(Number(rawVal))}
                      </span>
                    );
                  } else if (def.type === 'date') {
                    renderedVal = (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatDate(rawVal)}
                      </span>
                    );
                  } else if (def.type === 'url') {
                    renderedVal = (
                      <a
                        href={rawVal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >
                        {rawVal}
                      </a>
                    );
                  } else {
                    renderedVal = (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {String(rawVal)}
                      </span>
                    );
                  }
                }

                return (
                  <div key={def.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium block truncate" title={def.label}>
                        {def.label}
                      </span>
                      {def.required && (
                        <span className="text-rose-500 text-[10px] font-bold" title="Required field">*</span>
                      )}
                    </div>
                    <div className="truncate">{renderedVal}</div>
                  </div>
                );
              })}

              {/* Any extra legacy/custom keys stored on this entity */}
              {extraKeys.map((key) => {
                const rawVal = parsed[key];
                const label = key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase());

                return (
                  <div key={key} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium block mb-1 truncate" title={label}>
                      {label}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                      {String(rawVal)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
