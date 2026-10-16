import React, { useEffect, useState } from 'react';
import { useBranding } from './BrandingContext.js';
import { customizationApi } from './customizationApi.js';
import {
  CustomFieldDefinition,
  CustomFieldEntity,
  NumberingSchemeConfig,
  CustomStatusConfig,
  EmailTemplateConfig,
  PdfLabelConfig,
  FeatureFlagsConfig,
} from './types.js';
import { Modal } from '../components/Modal.js';
import {
  Sliders,
  Palette,
  FileText,
  Hash,
  Tag,
  Mail,
  Printer,
  ToggleLeft,
  Download,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Save,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { DisasterRecoveryCenter } from './DisasterRecoveryCenter.js';

export const CustomizationCenterPage: React.FC = () => {
  const { branding, updateBranding, refreshBranding } = useBranding();

  const [activeTab, setActiveTab] = useState<
    'branding' | 'fields' | 'numbering' | 'statuses' | 'email' | 'pdf' | 'features' | 'backup'
  >('branding');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // --- 1. Branding Form State ---
  const [brandForm, setBrandForm] = useState(branding);

  useEffect(() => {
    setBrandForm(branding);
  }, [branding]);

  // --- 2. Custom Fields State ---
  const [fieldEntity, setFieldEntity] = useState<CustomFieldEntity>('ASSET');
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [newFieldForm, setNewFieldForm] = useState({
    name: '',
    label: '',
    type: 'text' as any,
    required: false,
    placeholder: '',
    helpText: '',
    defaultValue: '',
    optionsString: '',
  });

  // --- 3. Numbering Schemes State ---
  const [schemes, setSchemes] = useState<Record<string, NumberingSchemeConfig>>({});
  const [selectedSchemeEntity, setSelectedSchemeEntity] = useState<'ASSET_ID' | 'ASSET_TAG' | 'TICKET' | 'PO'>('ASSET_TAG');
  const [previewSample, setPreviewSample] = useState('');

  // --- 4. Custom Statuses State ---
  const [statuses, setStatuses] = useState<CustomStatusConfig[]>([]);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatusForm, setNewStatusForm] = useState({
    code: '',
    name: '',
    category: 'IN_STOCK' as any,
    color: 'blue',
    hexColor: '#3b82f6',
    description: '',
    allowAllocation: false,
  });

  // --- 5. Email Templates State ---
  const [emailTemplates, setEmailTemplates] = useState<Record<string, EmailTemplateConfig>>({});
  const [selectedTrigger, setSelectedTrigger] = useState('ASSET_ALLOCATED');
  const [emailPreviewModalOpen, setEmailPreviewModalOpen] = useState(false);
  const [emailPreviewContent, setEmailPreviewContent] = useState({ subject: '', html: '' });

  // --- 6. PDF Templates State ---
  const [pdfConfig, setPdfConfig] = useState<PdfLabelConfig>({
    labelWidthMm: 70,
    labelHeightMm: 36,
    labelsPerRow: 3,
    labelsPerCol: 8,
    barcodeType: 'QR',
    showLogo: true,
    headerText: 'PROPERTY OF IT OPERATIONS',
    includeFields: ['assetTag', 'serialNumber', 'model', 'category'],
    customHandoverTerms: '',
  });

  // --- 7. Feature Flags State ---
  const [features, setFeatures] = useState<FeatureFlagsConfig>({
    enableSamLicenses: true,
    enableConsumables: true,
    enableEmployeePortal: true,
    enableMaintenance: true,
    enableCameraScanner: true,
    enableHardwareScanner: true,
    enableDigitalSignature: true,
    require2faAllAdmins: false,
    maintenanceMode: false,
    maintenanceMessage: '',
  });

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Load active tab data
  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'fields') {
        const data = await customizationApi.getFields(fieldEntity);
        setFields(data);
      } else if (activeTab === 'numbering') {
        const data = await customizationApi.getNumberingSchemes();
        setSchemes(data);
        if (data[selectedSchemeEntity]) {
          const sim = await customizationApi.previewNumbering({
            pattern: data[selectedSchemeEntity].pattern,
            prefix: data[selectedSchemeEntity].prefix,
            seqPadding: data[selectedSchemeEntity].seqPadding,
            sampleSeq: data[selectedSchemeEntity].currentSeq + 1,
          });
          setPreviewSample(sim);
        }
      } else if (activeTab === 'statuses') {
        const data = await customizationApi.getStatuses();
        setStatuses(data);
      } else if (activeTab === 'email') {
        const data = await customizationApi.getEmailTemplates();
        setEmailTemplates(data);
      } else if (activeTab === 'pdf') {
        const data = await customizationApi.getPdfTemplates();
        setPdfConfig(data);
      } else if (activeTab === 'features') {
        const data = await customizationApi.getFeatureFlags();
        setFeatures(data);
      }
    } catch (e: any) {
      showFeedback(e.response?.data?.message || 'Failed to load customization data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTabData();
  }, [activeTab, fieldEntity]);

  // Handle Branding Save
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateBranding(brandForm);
      showFeedback('Branding and white-label theme settings applied successfully');
    } catch (e: any) {
      showFeedback('Failed to update branding settings', 'error');
    }
  };

  // Handle Custom Field Add
  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const opts = newFieldForm.optionsString
        ? newFieldForm.optionsString.split(',').map((o) => o.trim()).filter(Boolean)
        : undefined;

      await customizationApi.addField(fieldEntity, {
        name: newFieldForm.name,
        label: newFieldForm.label,
        type: newFieldForm.type,
        required: newFieldForm.required,
        placeholder: newFieldForm.placeholder,
        helpText: newFieldForm.helpText,
        defaultValue: newFieldForm.defaultValue || undefined,
        options: opts,
      });

      setFieldModalOpen(false);
      setNewFieldForm({
        name: '',
        label: '',
        type: 'text',
        required: false,
        placeholder: '',
        helpText: '',
        defaultValue: '',
        optionsString: '',
      });
      const data = await customizationApi.getFields(fieldEntity);
      setFields(data);
      showFeedback(`Custom field created for ${fieldEntity}`);
    } catch (e: any) {
      showFeedback(e.response?.data?.message || 'Failed to add custom field', 'error');
    }
  };

  // Handle Field Delete
  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this custom field? Existing entity values will be retained in audit logs.')) return;
    try {
      await customizationApi.deleteField(fieldEntity, fieldId);
      const data = await customizationApi.getFields(fieldEntity);
      setFields(data);
      showFeedback('Custom field deleted');
    } catch (e: any) {
      showFeedback('Failed to delete field', 'error');
    }
  };

  // Handle Field Reorder
  const handleMoveField = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const copy = [...fields];
    const [moved] = copy.splice(index, 1);
    copy.splice(newIndex, 0, moved);

    const orderedIds = copy.map((f) => f.id);
    try {
      const reordered = await customizationApi.reorderFields(fieldEntity, orderedIds);
      setFields(reordered);
    } catch (e) {
      showFeedback('Failed to reorder fields', 'error');
    }
  };

  // Handle Numbering Scheme Save
  const handleSaveScheme = async () => {
    const current = schemes[selectedSchemeEntity];
    if (!current) return;
    try {
      await customizationApi.updateNumberingScheme(selectedSchemeEntity, current);
      showFeedback(`Numbering rule for ${selectedSchemeEntity} saved`);
      // Update preview
      const sim = await customizationApi.previewNumbering({
        pattern: current.pattern,
        prefix: current.prefix,
        seqPadding: current.seqPadding,
        sampleSeq: current.currentSeq + 1,
      });
      setPreviewSample(sim);
    } catch (e: any) {
      showFeedback('Failed to save numbering rule', 'error');
    }
  };

  // Handle Status Add
  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await customizationApi.addStatus(newStatusForm);
      setStatusModalOpen(false);
      setNewStatusForm({
        code: '',
        name: '',
        category: 'IN_STOCK',
        color: 'blue',
        hexColor: '#3b82f6',
        description: '',
        allowAllocation: false,
      });
      const data = await customizationApi.getStatuses();
      setStatuses(data);
      showFeedback('Custom lifecycle status added');
    } catch (e: any) {
      showFeedback(e.response?.data?.message || 'Failed to add status', 'error');
    }
  };

  // Handle Status Delete
  const handleDeleteStatus = async (id: string) => {
    if (!confirm('Are you sure you want to remove this custom status?')) return;
    try {
      await customizationApi.deleteStatus(id);
      const data = await customizationApi.getStatuses();
      setStatuses(data);
      showFeedback('Status removed');
    } catch (e: any) {
      showFeedback(e.response?.data?.message || 'Failed to delete status', 'error');
    }
  };

  // Handle Email Template Save
  const handleSaveEmailTemplate = async () => {
    const tmpl = emailTemplates[selectedTrigger];
    if (!tmpl) return;
    try {
      await customizationApi.updateEmailTemplate(selectedTrigger, tmpl);
      showFeedback(`Email notification template for ${tmpl.name} saved`);
    } catch (e: any) {
      showFeedback('Failed to save email template', 'error');
    }
  };

  // Handle Preview Email
  const handlePreviewEmail = async () => {
    const tmpl = emailTemplates[selectedTrigger];
    if (!tmpl) return;
    try {
      const rendered = await customizationApi.previewEmailTemplate(tmpl, {
        assetName: 'Apple MacBook Pro 16" M3 Max',
        assetTag: 'TAG-LAP-000042',
        serialNumber: 'C02G401QMD6T',
        employeeName: 'Sarah Jenkins (VP of Engineering)',
        allocationDate: new Date().toLocaleDateString(),
        returnDate: new Date().toLocaleDateString(),
        orgName: brandForm.companyName || 'Acme Global Corp',
        ticketNumber: 'TIK-000042',
        subject: 'Display port flickering on external monitor setup',
        priority: 'HIGH',
        itemName: 'USB-C Thunderbolt 4 Cable 2m',
        itemCode: 'CAB-TB4-02M',
        currentStock: 2,
        minQuantity: 5,
        expiryDate: new Date(Date.now() + 30 * 86400000).toLocaleDateString(),
        daysRemaining: 30,
        portalUrl: window.location.origin,
      });
      setEmailPreviewContent(rendered);
      setEmailPreviewModalOpen(true);
    } catch (e) {
      showFeedback('Failed to render email preview', 'error');
    }
  };

  // Handle PDF Templates Save
  const handleSavePdfConfig = async () => {
    try {
      await customizationApi.updatePdfTemplates(pdfConfig);
      showFeedback('Sticker sheet dimensions and Handover custody terms saved');
    } catch (e) {
      showFeedback('Failed to save PDF templates configuration', 'error');
    }
  };

  // Handle Feature Flags Save
  const handleSaveFeatures = async () => {
    try {
      await customizationApi.updateFeatureFlags(features);
      showFeedback('Modular feature toggles updated successfully');
    } catch (e) {
      showFeedback('Failed to update feature flags', 'error');
    }
  };

  // Handle Backup Export
  const handleExportBackup = async () => {
    try {
      const data = await customizationApi.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `itam-customization-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showFeedback('Customization backup snapshot exported');
    } catch (e) {
      showFeedback('Failed to export backup', 'error');
    }
  };

  // Handle Backup Import
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!confirm('Restoring this configuration will overwrite your current branding, numbering, and custom schemas. Proceed?')) return;
        await customizationApi.importBackup(parsed);
        await refreshBranding();
        await loadTabData();
        showFeedback('Customization backup restored and activated successfully!');
      } catch (err) {
        showFeedback('Failed to parse or restore backup JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Handle Reset Defaults
  const handleResetDefaults = async () => {
    if (!confirm('Are you sure you want to reset all customizations to factory defaults? This cannot be undone.')) return;
    try {
      await customizationApi.resetDefaults();
      await refreshBranding();
      await loadTabData();
      showFeedback('All customizations reset to factory defaults');
    } catch (e) {
      showFeedback('Failed to reset defaults', 'error');
    }
  };

  const navTabs = [
    { id: 'branding', label: 'Branding & Theme', icon: Palette },
    { id: 'fields', label: 'Custom Fields Builder', icon: FileText },
    { id: 'numbering', label: 'Numbering & Auto-Tagging', icon: Hash },
    { id: 'statuses', label: 'Statuses & Workflows', icon: Tag },
    { id: 'email', label: 'Email & Alert Templates', icon: Mail },
    { id: 'pdf', label: 'Barcode & PDF Designer', icon: Printer },
    { id: 'features', label: 'Modular Feature Flags', icon: ToggleLeft },
    { id: 'backup', label: 'Disaster Recovery & Backup', icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              SUPER ADMIN CONSOLE
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              v1.0.0
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1 flex items-center space-x-2">
            <Sliders className="w-6 h-6 text-blue-600" />
            <span>Enterprise Customization Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tailor any facet of the ITAM platform: schema extensions, numbering rules, lifecycle statuses, branding, and templates
          </p>
        </div>

        {statusMessage && (
          <div
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 animate-fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Main Tabbed Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm h-fit space-y-1">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-left transition-colors ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* TAB 1: BRANDING & THEME */}
          {activeTab === 'branding' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Branding, Theme & White-Labeling
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customize the organization identity, portal titles, currency conventions, and colors across the system.
                </p>
              </div>

              {/* Live Preview Card */}
              <div
                className="p-4 rounded-xl text-white shadow-sm flex items-center justify-between"
                style={{ backgroundColor: brandForm.headerBgColor || '#0f172a' }}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shadow-inner"
                    style={{ backgroundColor: brandForm.primaryColor || '#2563eb' }}
                  >
                    {brandForm.companyName?.substring(0, 2).toUpperCase() || 'IT'}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold tracking-tight">{brandForm.portalTitle}</h4>
                    <span className="text-[11px] text-slate-300">{brandForm.companyName}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className="px-2.5 py-1 rounded text-xs font-semibold text-white"
                    style={{ backgroundColor: brandForm.accentColor || '#10b981' }}
                  >
                    Live Preview
                  </span>
                  <span className="text-xs font-mono font-bold bg-white/10 px-2 py-1 rounded">
                    {brandForm.currencySymbol} 12,450.00
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveBranding} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Organization / Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={brandForm.companyName}
                      onChange={(e) => setBrandForm({ ...brandForm, companyName: e.target.value })}
                      placeholder="e.g. Acme Global Corporation"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Portal Header Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={brandForm.portalTitle}
                      onChange={(e) => setBrandForm({ ...brandForm, portalTitle: e.target.value })}
                      placeholder="e.g. ITAM Enterprise Hub"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Primary Brand Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={brandForm.primaryColor}
                        onChange={(e) => setBrandForm({ ...brandForm, primaryColor: e.target.value })}
                        className="w-9 h-9 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer bg-white"
                      />
                      <input
                        type="text"
                        value={brandForm.primaryColor}
                        onChange={(e) => setBrandForm({ ...brandForm, primaryColor: e.target.value })}
                        className="flex-1 font-mono uppercase px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Accent Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={brandForm.accentColor}
                        onChange={(e) => setBrandForm({ ...brandForm, accentColor: e.target.value })}
                        className="w-9 h-9 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer bg-white"
                      />
                      <input
                        type="text"
                        value={brandForm.accentColor}
                        onChange={(e) => setBrandForm({ ...brandForm, accentColor: e.target.value })}
                        className="flex-1 font-mono uppercase px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Header Background Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={brandForm.headerBgColor}
                        onChange={(e) => setBrandForm({ ...brandForm, headerBgColor: e.target.value })}
                        className="w-9 h-9 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer bg-white"
                      />
                      <input
                        type="text"
                        value={brandForm.headerBgColor}
                        onChange={(e) => setBrandForm({ ...brandForm, headerBgColor: e.target.value })}
                        className="flex-1 font-mono uppercase px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Currency Symbol & Code
                    </label>
                    <select
                      value={brandForm.currencySymbol}
                      onChange={(e) => {
                        const sym = e.target.value;
                        const codeMap: Record<string, string> = {
                          '$': 'USD',
                          '€': 'EUR',
                          '£': 'GBP',
                          '₹': 'INR',
                          '¥': 'JPY',
                          'A$': 'AUD',
                          'C$': 'CAD',
                        };
                        setBrandForm({
                          ...brandForm,
                          currencySymbol: sym,
                          currencyCode: codeMap[sym] || 'USD',
                        });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                    >
                      <option value="$">$ (USD / CAD / AUD)</option>
                      <option value="€">€ (EUR - Euro)</option>
                      <option value="£">£ (GBP - British Pound)</option>
                      <option value="₹">₹ (INR - Indian Rupee)</option>
                      <option value="¥">¥ (JPY / CNY)</option>
                      <option value="A$">A$ (AUD - Australian Dollar)</option>
                      <option value="C$">C$ (CAD - Canadian Dollar)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Date Display Format
                    </label>
                    <select
                      value={brandForm.dateFormat}
                      onChange={(e) => setBrandForm({ ...brandForm, dateFormat: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601 Standard)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (UK / International)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Support Helpdesk Email
                    </label>
                    <input
                      type="email"
                      value={brandForm.supportEmail}
                      onChange={(e) => setBrandForm({ ...brandForm, supportEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Login Screen Notice / Welcome Banner
                  </label>
                  <textarea
                    rows={2}
                    value={brandForm.loginBannerText}
                    onChange={(e) => setBrandForm({ ...brandForm, loginBannerText: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>Custom CSS Override (Optional)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Injected live into application DOM</span>
                  </label>
                  <textarea
                    rows={3}
                    value={brandForm.customCss || ''}
                    onChange={(e) => setBrandForm({ ...brandForm, customCss: e.target.value })}
                    placeholder="/* Custom corporate CSS overrides */"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-[11px]"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Branding Configuration</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: DYNAMIC CUSTOM FIELDS BUILDER */}
          {activeTab === 'fields' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Dynamic Custom Fields & Schema Builder
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Extend entity forms with custom attributes. Fields automatically render in creation forms and detail views.
                  </p>
                </div>

                <button
                  onClick={() => setFieldModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Field</span>
                </button>
              </div>

              {/* Entity Selector Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                {[
                  { id: 'ASSET', label: 'Hardware Assets' },
                  { id: 'EMPLOYEE', label: 'Employees / Users' },
                  { id: 'TICKET', label: 'Helpdesk Tickets' },
                  { id: 'MAINTENANCE', label: 'Maintenance Logs' },
                  { id: 'LICENSE', label: 'Software Licenses' },
                  { id: 'CONSUMABLE', label: 'Consumables & Parts' },
                ].map((ent) => (
                  <button
                    key={ent.id}
                    onClick={() => setFieldEntity(ent.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      fieldEntity === ent.id
                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {ent.label}
                  </button>
                ))}
              </div>

              {/* Fields Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Order</th>
                      <th className="py-2.5 px-3">Field Label</th>
                      <th className="py-2.5 px-3">Key (API Name)</th>
                      <th className="py-2.5 px-3">Field Type</th>
                      <th className="py-2.5 px-3">Required</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {fields.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                          No custom specification fields configured for {fieldEntity}. Click "Add Custom Field" to create one.
                        </td>
                      </tr>
                    ) : (
                      fields.map((f, idx) => (
                        <tr key={f.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            <div className="flex items-center space-x-1">
                              <button
                                disabled={idx === 0}
                                onClick={() => handleMoveField(idx, 'up')}
                                className="p-0.5 hover:text-blue-600 disabled:opacity-30"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                disabled={idx === fields.length - 1}
                                onClick={() => handleMoveField(idx, 'down')}
                                className="p-0.5 hover:text-blue-600 disabled:opacity-30"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{f.order}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                            {f.label}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                            {f.name}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {f.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {f.required ? (
                              <span className="text-rose-600 font-semibold text-[11px]">Yes (Mandatory)</span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Optional</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleDeleteField(f.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Delete Field"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: NUMBERING SCHEMES & AUTO-TAGGING */}
          {activeTab === 'numbering' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Numbering Schemes & Auto-Tagging Engine
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure customizable prefix and sequence patterns for Asset IDs, Barcode Asset Tags, and Tickets.
                </p>
              </div>

              {/* Entity Selector */}
              <div className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                {[
                  { id: 'ASSET_TAG', label: 'Asset Tag (Physical Sticker)' },
                  { id: 'ASSET_ID', label: 'Asset Master ID' },
                  { id: 'TICKET', label: 'Helpdesk Ticket #' },
                  { id: 'PO', label: 'Purchase Order #' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSchemeEntity(s.id as any);
                      const cur = schemes[s.id];
                      if (cur) {
                        customizationApi
                          .previewNumbering({
                            pattern: cur.pattern,
                            prefix: cur.prefix,
                            seqPadding: cur.seqPadding,
                            sampleSeq: cur.currentSeq + 1,
                          })
                          .then(setPreviewSample);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      selectedSchemeEntity === s.id
                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {schemes[selectedSchemeEntity] && (
                <div className="space-y-4 text-xs">
                  {/* Live Simulation Banner */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 block">
                        Next Generated Value (Live Simulation)
                      </span>
                      <span className="text-base font-mono font-bold text-blue-900 dark:text-blue-100">
                        {previewSample || 'CALCULATING...'}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-[11px] font-mono text-blue-600 font-bold">
                      Sequence #{schemes[selectedSchemeEntity].currentSeq + 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Prefix Token
                      </label>
                      <input
                        type="text"
                        value={schemes[selectedSchemeEntity].prefix}
                        onChange={(e) => {
                          const updated = { ...schemes[selectedSchemeEntity], prefix: e.target.value };
                          setSchemes({ ...schemes, [selectedSchemeEntity]: updated });
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Zero Padding Length
                      </label>
                      <input
                        type="number"
                        min={3}
                        max={10}
                        value={schemes[selectedSchemeEntity].seqPadding}
                        onChange={(e) => {
                          const updated = {
                            ...schemes[selectedSchemeEntity],
                            seqPadding: parseInt(e.target.value, 10) || 6,
                          };
                          setSchemes({ ...schemes, [selectedSchemeEntity]: updated });
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Reset Frequency
                      </label>
                      <select
                        value={schemes[selectedSchemeEntity].resetFrequency}
                        onChange={(e) => {
                          const updated = { ...schemes[selectedSchemeEntity], resetFrequency: e.target.value as any };
                          setSchemes({ ...schemes, [selectedSchemeEntity]: updated });
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                      >
                        <option value="NEVER">Never (Perpetual)</option>
                        <option value="YEARLY">Yearly (Resets Jan 1)</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Pattern Template</span>
                      <span className="text-[10px] text-slate-400">Click a token chip below to append</span>
                    </label>
                    <input
                      type="text"
                      value={schemes[selectedSchemeEntity].pattern}
                      onChange={(e) => {
                        const updated = { ...schemes[selectedSchemeEntity], pattern: e.target.value };
                        setSchemes({ ...schemes, [selectedSchemeEntity]: updated });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-blue-600"
                    />

                    {/* Token Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['{PREFIX}', '{YYYY}', '{YY}', '{MM}', '{CAT}', '{DEPT}', '{SEQ:5}', '{SEQ:6}'].map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() => {
                            const cur = schemes[selectedSchemeEntity];
                            const updated = { ...cur, pattern: `${cur.pattern}-${tok}` };
                            setSchemes({ ...schemes, [selectedSchemeEntity]: updated });
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                          + {tok}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleSaveScheme}
                      className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Numbering Rule</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CUSTOM STATUSES & WORKFLOWS */}
          {activeTab === 'statuses' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Lifecycle Statuses & Asset Workflows
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure custom asset inventory statuses, badge colors, and deployment eligibility rules.
                  </p>
                </div>

                <button
                  onClick={() => setStatusModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Status</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Status Code</th>
                      <th className="py-2.5 px-3">Display Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Deployable</th>
                      <th className="py-2.5 px-3">Badge Preview</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {statuses.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {s.code}
                          {s.isDefault && (
                            <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 font-normal">
                              System
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          {s.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {s.category.replace('_', ' ')}
                        </td>
                        <td className="py-2.5 px-3">
                          {s.allowAllocation ? (
                            <span className="text-emerald-600 font-semibold text-[11px]">Yes</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-semibold text-white shadow-xs"
                            style={{ backgroundColor: s.hexColor || '#3b82f6' }}
                          >
                            {s.name}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!s.isDefault && (
                            <button
                              onClick={() => handleDeleteStatus(s.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Delete Status"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: EMAIL & ALERT TEMPLATES */}
          {activeTab === 'email' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Email Notification & Alert Templates
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Customize the email subjects, HTML layouts, and dynamic variable tokens dispatched to employees and technicians.
                  </p>
                </div>

                <button
                  onClick={handlePreviewEmail}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Rendered Email</span>
                </button>
              </div>

              {/* Template Selector */}
              <div className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                {Object.keys(emailTemplates).map((trig) => (
                  <button
                    key={trig}
                    onClick={() => setSelectedTrigger(trig)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      selectedTrigger === trig
                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {emailTemplates[trig]?.name || trig}
                  </button>
                ))}
              </div>

              {emailTemplates[selectedTrigger] && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Email Subject Line
                    </label>
                    <input
                      type="text"
                      value={emailTemplates[selectedTrigger].subject}
                      onChange={(e) => {
                        const updated = { ...emailTemplates[selectedTrigger], subject: e.target.value };
                        setEmailTemplates({ ...emailTemplates, [selectedTrigger]: updated });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>HTML Body Template</span>
                      <span className="text-[10px] text-slate-400">Insert available token variables:</span>
                    </label>
                    <textarea
                      rows={12}
                      value={emailTemplates[selectedTrigger].htmlBody}
                      onChange={(e) => {
                        const updated = { ...emailTemplates[selectedTrigger], htmlBody: e.target.value };
                        setEmailTemplates({ ...emailTemplates, [selectedTrigger]: updated });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-[11px]"
                    />

                    {/* Tokens Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(emailTemplates[selectedTrigger].availableTokens || []).map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() => {
                            const cur = emailTemplates[selectedTrigger];
                            const updated = { ...cur, htmlBody: `${cur.htmlBody} {{${tok}}}` };
                            setEmailTemplates({ ...emailTemplates, [selectedTrigger]: updated });
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                        >
                          + {`{{${tok}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      onClick={handleSaveEmailTemplate}
                      className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Template</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PDF & LABEL DESIGNER */}
          {activeTab === 'pdf' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Barcode Label & PDF Certificate Customizer
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure sticker sheet dimensions, barcode symbologies, and legal terms on handover certificates.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form Controls */}
                <div className="lg:col-span-7 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Label Header Banner Text
                      </label>
                      <input
                        type="text"
                        value={pdfConfig.headerText}
                        onChange={(e) => setPdfConfig({ ...pdfConfig, headerText: e.target.value })}
                        placeholder="e.g. PROPERTY OF IT OPERATIONS"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg uppercase"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Barcode Symbology & Sticker Format
                      </label>
                      <select
                        value={pdfConfig.barcodeType}
                        onChange={(e) => setPdfConfig({ ...pdfConfig, barcodeType: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                      >
                        <option value="QR">2D QR Code Only (Restructured Modern Layout — No 1D Barcode)</option>
                        <option value="CODE128">1D Barcode Only — Code 128 (High-Density Linear Barcode — No QR)</option>
                        <option value="CODE39">1D Barcode Only — Code 39 (Standard Industrial Barcode — No QR)</option>
                        <option value="BOTH">Dual Symbology (Both Top-Right QR Code & Bottom 1D Barcode)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Handover Acknowledgement Certificate — Custom Terms of Custody</span>
                      <span className="text-[10px] text-slate-400">Appears on official employee sign-off PDF</span>
                    </label>
                    <textarea
                      rows={6}
                      value={pdfConfig.customHandoverTerms}
                      onChange={(e) => setPdfConfig({ ...pdfConfig, customHandoverTerms: e.target.value })}
                      placeholder="Enter each policy bullet point on a separate line..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg leading-relaxed text-xs"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleSavePdfConfig}
                      className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save PDF Template Configuration</span>
                    </button>
                  </div>
                </div>

                {/* Live Sticker Mockup Preview */}
                <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Live Barcode Sticker Preview
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pdfConfig.barcodeType === 'QR'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : pdfConfig.barcodeType === 'BOTH'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                      }`}>
                        {pdfConfig.barcodeType === 'QR'
                          ? 'Restructured QR Layout (No Barcode)'
                          : pdfConfig.barcodeType === 'BOTH'
                          ? 'Dual Symbology (QR + Barcode)'
                          : '1D Barcode Only (No QR Code)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Shows exact text wrapping, symmetrical grid alignment, and symbology layout.
                    </p>

                    {/* Sticker Card Mockup */}
                    <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white text-slate-900 shadow-md">
                      {/* Top Header */}
                      <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wide truncate max-w-[200px]">
                          {pdfConfig.headerText || brandForm.companyName || 'GLOBAL TECHNOLOGIES INC.'}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold shrink-0">
                          IT ASSET
                        </span>
                      </div>

                      {pdfConfig.barcodeType === 'QR' ? (
                        /* RESTRUCTURED MODERN QR-ONLY LAYOUT (NO 1D BARCODE) */
                        <div className="p-3">
                          <div className="flex items-stretch gap-3">
                            {/* Left Hero QR Column */}
                            <div className="w-24 shrink-0 flex flex-col items-center justify-between space-y-2">
                              {/* QR Box */}
                              <div className="w-20 h-20 border border-slate-200 rounded-lg p-1.5 flex items-center justify-center bg-white shadow-xs">
                                <svg className="w-16 h-16" viewBox="0 0 25 25" fill="none">
                                  <rect width="25" height="25" fill="white" />
                                  <rect x="2" y="2" width="7" height="7" fill="black" />
                                  <rect x="3" y="3" width="5" height="5" fill="white" />
                                  <rect x="4" y="4" width="3" height="3" fill="black" />
                                  <rect x="16" y="2" width="7" height="7" fill="black" />
                                  <rect x="17" y="3" width="5" height="5" fill="white" />
                                  <rect x="18" y="4" width="3" height="3" fill="black" />
                                  <rect x="2" y="16" width="7" height="7" fill="black" />
                                  <rect x="3" y="17" width="5" height="5" fill="white" />
                                  <rect x="4" y="18" width="3" height="3" fill="black" />
                                  <rect x="11" y="4" width="2" height="4" fill="black" />
                                  <rect x="11" y="11" width="3" height="3" fill="black" />
                                  <rect x="16" y="12" width="4" height="2" fill="black" />
                                  <rect x="12" y="18" width="3" height="5" fill="black" />
                                  <rect x="18" y="18" width="5" height="3" fill="black" />
                                </svg>
                              </div>
                              {/* Asset ID Badge Directly Below QR Code */}
                              <div className="w-full bg-blue-50 border border-blue-200 rounded-md py-1 px-1.5 text-center">
                                <div className="text-[7px] font-bold text-blue-600 uppercase tracking-wider">ASSET ID</div>
                                <div className="text-[10px] font-bold text-blue-800 font-mono leading-tight truncate">IT-COM-000045</div>
                              </div>
                            </div>

                            {/* Center Divider Line */}
                            <div className="w-px bg-slate-200 self-stretch" />

                            {/* Right Details Panel */}
                            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between space-y-1.5 min-w-0">
                              {/* Row 1: Equipment / Model */}
                              <div>
                                <div className="text-[7px] font-bold text-slate-500 uppercase tracking-wider">EQUIPMENT / MODEL</div>
                                <div className="text-[10px] font-bold text-slate-900 leading-snug line-clamp-2">HP ZBook Studio G10 Mobile Workstation</div>
                              </div>
                              <div className="border-t border-slate-200" />

                              {/* Row 2: Serial Number */}
                              <div>
                                <div className="text-[7px] font-bold text-slate-500 uppercase tracking-wider">SERIAL NUMBER</div>
                                <div className="text-[10px] font-bold text-slate-900 font-mono truncate">SN-HP-ZB10-0045</div>
                              </div>
                              <div className="border-t border-slate-200" />

                              {/* Row 3: User */}
                              <div>
                                <div className="text-[7px] font-bold text-slate-500 uppercase tracking-wider">USER</div>
                                <div className="text-[10px] font-bold text-slate-800 truncate">Unassigned (In Stock)</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : pdfConfig.barcodeType === 'BOTH' ? (
                        /* DUAL BARCODE LAYOUT (BOTH QR & 1D BARCODE) */
                        <>
                          <div className="p-3 flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="text-[11px] font-bold text-slate-900 truncate">
                                TAG: TAG-IT-COM-000011
                              </div>
                              <div className="text-[10px] font-bold text-blue-600 truncate">
                                ID: IT-COM-000011
                              </div>
                              <div className="text-[10px] text-slate-600 truncate">
                                S/N: SN-HP-ZB10-1791061580561
                              </div>
                              <div className="text-[10px] text-slate-800 leading-snug">
                                Model: HP ZBook Studio G10 Mobile Workstation
                              </div>
                              <div className="text-[9px] text-slate-500 font-medium pt-0.5">
                                Cat: Computing
                              </div>
                            </div>

                            <div className="shrink-0 w-16 h-16 border border-slate-200 rounded p-1 flex items-center justify-center bg-white">
                              <svg className="w-14 h-14" viewBox="0 0 25 25" fill="none">
                                <rect width="25" height="25" fill="white" />
                                <rect x="2" y="2" width="7" height="7" fill="black" />
                                <rect x="3" y="3" width="5" height="5" fill="white" />
                                <rect x="4" y="4" width="3" height="3" fill="black" />
                                <rect x="16" y="2" width="7" height="7" fill="black" />
                                <rect x="17" y="3" width="5" height="5" fill="white" />
                                <rect x="18" y="4" width="3" height="3" fill="black" />
                                <rect x="2" y="16" width="7" height="7" fill="black" />
                                <rect x="3" y="17" width="5" height="5" fill="white" />
                                <rect x="4" y="18" width="3" height="3" fill="black" />
                                <rect x="11" y="4" width="2" height="4" fill="black" />
                                <rect x="11" y="11" width="3" height="3" fill="black" />
                                <rect x="16" y="12" width="4" height="2" fill="black" />
                                <rect x="12" y="18" width="3" height="5" fill="black" />
                                <rect x="18" y="18" width="5" height="3" fill="black" />
                              </svg>
                            </div>
                          </div>

                          <div className="border-t border-slate-200 mx-3" />

                          <div className="p-2.5 text-center space-y-1">
                            <div className="flex items-center justify-center space-x-0.5 h-6 overflow-hidden">
                              {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1].map((w, i) => (
                                <div key={i} className="bg-black h-full" style={{ width: `${w}px` }} />
                              ))}
                            </div>
                            <div className="text-[10px] font-mono font-bold text-slate-900 tracking-wider">
                              * TAG-IT-COM-000011 *
                            </div>
                          </div>
                        </>
                      ) : (
                        /* PURE 1D BARCODE ONLY LAYOUT (NO QR CODE) */
                        <div className="p-3 space-y-2">
                          {/* Asset Tag in bold blue */}
                          <div className="text-[12px] font-bold text-blue-600 font-mono tracking-tight truncate">
                            TAG-IT-COM-000011
                          </div>

                          {/* Full-width Model Name */}
                          <div className="text-[10px] font-bold text-slate-900 leading-snug line-clamp-2">
                            HP ZBook Studio G10 Mobile Workstation
                          </div>

                          {/* 2-Column Metadata Grid */}
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <div className="truncate"><span className="text-slate-400 font-bold">S/N:</span> SN-HP-ZB10-0045</div>
                            <div className="truncate"><span className="text-slate-400 font-bold">Cat:</span> Computing</div>
                            <div className="truncate"><span className="text-slate-400 font-bold">User:</span> Unassigned (In Stock)</div>
                            <div className="truncate"><span className="text-slate-400 font-bold">ID:</span> IT-COM-000011</div>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-slate-200" />

                          {/* 1D Barcode Strip (No QR Code) */}
                          <div className="pt-0.5 text-center space-y-1">
                            <div className="flex items-center justify-center space-x-0.5 h-7 overflow-hidden">
                              {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3].map((w, i) => (
                                <div key={i} className="bg-slate-900 h-full" style={{ width: `${w}px` }} />
                              ))}
                            </div>
                            <div className="text-[10px] font-mono font-bold text-slate-900 tracking-widest">
                              * TAG-IT-COM-000011 *
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Bottom Footer Notice */}
                      <div className="bg-slate-50 border-t border-slate-200 py-1 px-3 text-center">
                        <span className="text-[8px] text-slate-500 font-medium tracking-wide uppercase">
                          PROPERTY OF {pdfConfig.headerText || brandForm.companyName || 'GLOBAL TECHNOLOGIES INC.'} • DO NOT REMOVE
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: MODULAR FEATURE FLAGS */}
          {activeTab === 'features' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Modular Enterprise Feature Switches
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enable or disable entire functional modules based on organizational requirements.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: 'enableSamLicenses',
                    label: 'Software Asset Management (SAM) Licenses',
                    desc: 'Manage license contracts, subscriptions, seat allocation, and compliance counters',
                  },
                  {
                    key: 'enableConsumables',
                    label: 'Consumables, Cables & Spare Parts Inventory',
                    desc: 'Track bulk accessories, toners, RAM sticks, and automated minimum threshold alerts',
                  },
                  {
                    key: 'enableEmployeePortal',
                    label: 'Employee Self-Service Custody Portal',
                    desc: 'Allow staff to log in, review equipment in custody, sign receipts, and submit tickets',
                  },
                  {
                    key: 'enableMaintenance',
                    label: 'Hardware Servicing & RMA Tracking',
                    desc: 'Record vendor repairs, maintenance costs, downtime hours, and replacement parts',
                  },
                  {
                    key: 'enableCameraScanner',
                    label: 'In-Browser Webcam Barcode / QR Scanner',
                    desc: 'Enable HTML5 camera stream for barcode scanning directly in the web browser',
                  },
                  {
                    key: 'enableHardwareScanner',
                    label: 'USB / Bluetooth Physical Gun Wedge Listener',
                    desc: 'Detect high-speed keystroke bursts from physical barcode scanners globally',
                  },
                  {
                    key: 'enableDigitalSignature',
                    label: 'Mandatory Digital Signature Pad at Handover',
                    desc: 'Require touch or stylus signatures before issuing custody certificates',
                  },
                  {
                    key: 'require2faAllAdmins',
                    label: 'Enforce Two-Factor Authentication (2FA) for Admins',
                    desc: 'Mandate TOTP authenticator setup for IT Admins and Support Engineers',
                  },
                ].map((item) => {
                  const isChecked = !!(features as any)[item.key];
                  return (
                    <div
                      key={item.key}
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">
                          {item.label}
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                          {item.desc}
                        </span>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isChecked}
                        onClick={() => setFeatures({ ...features, [item.key]: !isChecked })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          isChecked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            isChecked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Maintenance Mode Banner */}
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-2 flex-1 min-w-0 pr-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                        System Maintenance Mode
                      </span>
                      <span className="text-[11px] text-amber-700/80 dark:text-amber-400 block mt-0.5">
                        Restrict non-admin portal access and display a system maintenance banner
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={features.maintenanceMode}
                    onClick={() => setFeatures({ ...features, maintenanceMode: !features.maintenanceMode })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                      features.maintenanceMode ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        features.maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {features.maintenanceMode && (
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 dark:text-amber-200 mb-1">
                      Maintenance Notice Displayed to Users:
                    </label>
                    <input
                      type="text"
                      value={features.maintenanceMessage || ''}
                      onChange={(e) => setFeatures({ ...features, maintenanceMessage: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveFeatures}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Apply Feature Configuration</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 8: DISASTER RECOVERY & BACKUP */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {/* Full Enterprise DR & Cloud Sync Engine */}
              <DisasterRecoveryCenter />

              {/* Lightweight Configuration-Only Export & Factory Reset */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Configuration-Only Migration & Factory Reset
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Export lightweight UI customization state into a standalone JSON file, import into another environment, or restore factory defaults.
                  </p>
                </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Export Card */}
                <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 bg-slate-50/50 dark:bg-slate-800/20">
                  <Download className="w-6 h-6 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Export Configuration Snapshot
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Download all custom fields, numbering sequences, branding tokens, and templates as an offline JSON file.
                  </p>
                  <button
                    onClick={handleExportBackup}
                    className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 bg-slate-50/50 dark:bg-slate-800/20">
                  <Upload className="w-6 h-6 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Restore from Configuration JSON
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Upload a previously exported JSON backup to seamlessly restore or clone settings from a test instance.
                  </p>
                  <label className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload & Restore File</span>
                    <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>Factory Reset</span>
                </h4>
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-rose-900 dark:text-rose-200 block">
                      Reset All Customizations to Default Settings
                    </span>
                    <span className="text-[11px] text-rose-700 dark:text-rose-400">
                      Restores default theme colors, default numbering rules, and default templates.
                    </span>
                  </div>
                  <button
                    onClick={handleResetDefaults}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Custom Field Modal */}
      <Modal
        isOpen={fieldModalOpen}
        onClose={() => setFieldModalOpen(false)}
        title={`Add Custom Field — ${fieldEntity}`}
        maxWidth="md"
      >
        <form onSubmit={handleAddField} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Field Label (User-Facing) *
            </label>
            <input
              type="text"
              required
              value={newFieldForm.label}
              onChange={(e) => {
                const l = e.target.value;
                const autoKey = l
                  .replace(/[^a-zA-Z0-9 ]/g, '')
                  .split(' ')
                  .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
                  .join('');
                setNewFieldForm({ ...newFieldForm, label: l, name: autoKey });
              }}
              placeholder="e.g. Primary GPU VRAM"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                API Key Name *
              </label>
              <input
                type="text"
                required
                value={newFieldForm.name}
                onChange={(e) => setNewFieldForm({ ...newFieldForm, name: e.target.value })}
                placeholder="primaryGpuVram"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Field Data Type *
              </label>
              <select
                value={newFieldForm.type}
                onChange={(e) => setNewFieldForm({ ...newFieldForm, type: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="text">Text (Single Line)</option>
                <option value="number">Number (Integer / Decimal)</option>
                <option value="currency">Currency Amount</option>
                <option value="date">Date Picker</option>
                <option value="select">Dropdown Select</option>
                <option value="checkbox">Checkbox (Boolean)</option>
                <option value="textarea">Textarea (Multi-Line)</option>
                <option value="email">Email Address</option>
                <option value="url">URL Link</option>
              </select>
            </div>
          </div>

          {newFieldForm.type === 'select' && (
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dropdown Options (Comma-Separated) *
              </label>
              <input
                type="text"
                required
                value={newFieldForm.optionsString}
                onChange={(e) => setNewFieldForm({ ...newFieldForm, optionsString: e.target.value })}
                placeholder="e.g. Low, Medium, High, Critical"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Default Value (Optional)
            </label>
            <input
              type="text"
              value={newFieldForm.defaultValue}
              onChange={(e) => setNewFieldForm({ ...newFieldForm, defaultValue: e.target.value })}
              placeholder="e.g. Standard, 0, or initial preset"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Placeholder Hint
            </label>
            <input
              type="text"
              value={newFieldForm.placeholder}
              onChange={(e) => setNewFieldForm({ ...newFieldForm, placeholder: e.target.value })}
              placeholder="e.g. Enter details..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Help Text Guidance
            </label>
            <input
              type="text"
              value={newFieldForm.helpText}
              onChange={(e) => setNewFieldForm({ ...newFieldForm, helpText: e.target.value })}
              placeholder="Instructions displayed below the field..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="fieldReq"
              checked={newFieldForm.required}
              onChange={(e) => setNewFieldForm({ ...newFieldForm, required: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="fieldReq" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
              Mark this field as Required (Mandatory)
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setFieldModalOpen(false)}
              className="px-3.5 py-2 text-slate-500 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm"
            >
              Save Custom Field
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Custom Status Modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Add Custom Lifecycle Status"
        maxWidth="md"
      >
        <form onSubmit={handleAddStatus} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Display Name *
            </label>
            <input
              type="text"
              required
              value={newStatusForm.name}
              onChange={(e) => {
                const n = e.target.value;
                const autoCode = n.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                setNewStatusForm({ ...newStatusForm, name: n, code: autoCode });
              }}
              placeholder="e.g. Legal Hold / Forensic Audit"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status Code *
              </label>
              <input
                type="text"
                required
                value={newStatusForm.code}
                onChange={(e) => setNewStatusForm({ ...newStatusForm, code: e.target.value })}
                placeholder="LEGAL_HOLD"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category Group *
              </label>
              <select
                value={newStatusForm.category}
                onChange={(e) => setNewStatusForm({ ...newStatusForm, category: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="IN_STOCK">In Stock (Inventory)</option>
                <option value="IN_USE">In Use (Active Deploy)</option>
                <option value="MAINTENANCE">Maintenance (Servicing)</option>
                <option value="DISPOSED">Disposed (End of Life)</option>
                <option value="RESERVED">Reserved</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Badge Color
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={newStatusForm.hexColor}
                onChange={(e) => setNewStatusForm({ ...newStatusForm, hexColor: e.target.value })}
                className="w-9 h-9 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer bg-white"
              />
              <span
                className="px-3 py-1.5 rounded text-white text-xs font-semibold shadow-xs"
                style={{ backgroundColor: newStatusForm.hexColor }}
              >
                {newStatusForm.name || 'Sample Badge'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="stAllow"
              checked={newStatusForm.allowAllocation}
              onChange={(e) => setNewStatusForm({ ...newStatusForm, allowAllocation: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="stAllow" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
              Allow equipment in this status to be assigned to employees
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setStatusModalOpen(false)}
              className="px-3.5 py-2 text-slate-500 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm"
            >
              Save Status
            </button>
          </div>
        </form>
      </Modal>

      {/* Email Preview Modal */}
      <Modal
        isOpen={emailPreviewModalOpen}
        onClose={() => setEmailPreviewModalOpen(false)}
        title="Email Notification Preview"
        maxWidth="lg"
      >
        <div className="space-y-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs space-y-1">
            <div className="text-slate-500">
              Subject: <strong className="text-slate-900 dark:text-slate-100">{emailPreviewContent.subject}</strong>
            </div>
          </div>

          <div
            className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white overflow-auto max-h-96"
            dangerouslySetInnerHTML={{ __html: emailPreviewContent.html }}
          />

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setEmailPreviewModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold"
            >
              Close Preview
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
