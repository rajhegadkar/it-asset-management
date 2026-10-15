import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import {
  Settings,
  Building,
  Barcode,
  RefreshCw,
  CheckCircle2,
  Mail,
  Send,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Check,
  Server,
  FileCheck,
  Database,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Layers,
  Building2,
  Tag,
  Truck,
  X,
} from 'lucide-react';
import { useBranding } from '../customization/BrandingContext.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Modal } from '../components/Modal.js';

export const SettingsPage: React.FC = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const { updateUserOrganization } = useAuth();
  const { branding: globalBranding, updateBranding: updateBrandingContext, refreshBranding } = useBranding();
  const [activeTab, setActiveTab] = useState<'branding' | 'numbering' | 'email' | 'masterData' | 'audit' | 'health'>('branding');

  // Branding Form
  const [branding, setBranding] = useState({
    companyName: 'Acme Global Technologies Inc.',
    address: '100 Innovation Blvd, Suite 500, San Francisco, CA 94105, USA',
    email: 'it-support@acme-corp.com',
    phone: '+1 (415) 555-0199',
    taxId: 'US-EIN-94-3829104',
    currency: 'USD',
  });

  // Numbering Form
  const [numbering, setNumbering] = useState({
    prefix: 'IT',
    padding: '6',
    pattern: '{PREFIX}-{CATEGORY}-{NUMBER:6}',
    barcodeType: 'CODE128',
  });

  // Email Notification Settings
  const [emailConfig, setEmailConfig] = useState({
    provider: 'google_workspace' as 'google_workspace' | 'office_365' | 'custom',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    fromName: 'IT Asset Management',
    fromEmail: '',
    enableTls: true,
    notificationsEnabled: true,
    notifyOnAllocation: true,
    notifyOnReturn: true,
    notifyOnTicket: true,
    notifyOnMaintenance: true,
    notifyOnExpiry: true,
    hasPassword: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [healthStatus, setHealthStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Master Data State
  const [masterSubTab, setMasterSubTab] = useState<'departments' | 'locations' | 'categories' | 'vendors'>('departments');
  const [departments, setDepartments] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);

  // Master Data Modals
  const [masterModalType, setMasterModalType] = useState<'dept' | 'loc' | 'cat' | 'vnd' | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', departmentHead: '', costCenter: '' });
  const [locForm, setLocForm] = useState({ name: '', code: '', type: 'OFFICE', address: '' });
  const [catForm, setCatForm] = useState({ name: '', code: '', description: '' });
  const [vndForm, setVndForm] = useState({ name: '', code: '', contactPerson: '', email: '', phone: '', website: '' });

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/org/departments');
      setDepartments(res.data.data || []);
    } catch {}
  };
  const fetchLocations = async () => {
    try {
      const res = await api.get('/org/locations');
      setLocations(res.data.data || []);
    } catch {}
  };
  const fetchCategories = async () => {
    try {
      const res = await api.get('/org/categories');
      setCategories(res.data.data || []);
    } catch {}
  };
  const fetchVendors = async () => {
    try {
      const res = await api.get('/org/vendors');
      setVendors(res.data.data || []);
    } catch {}
  };
  const fetchAllMasterData = async () => {
    setMasterLoading(true);
    await Promise.all([fetchDepartments(), fetchLocations(), fetchCategories(), fetchVendors()]);
    setMasterLoading(false);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/org/departments/${editingItem.id}`, deptForm);
        showSuccess('Department updated successfully');
      } else {
        await api.post('/org/departments', deptForm);
        showSuccess('Department created successfully');
      }
      setMasterModalType(null);
      setEditingItem(null);
      fetchDepartments();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to save department');
    }
  };

  const handleDeleteDept = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete department "${name}"?`)) return;
    try {
      await api.delete(`/org/departments/${id}`);
      showSuccess(`Department "${name}" deleted`);
      fetchDepartments();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete department');
    }
  };

  const handleSaveLoc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/org/locations/${editingItem.id}`, locForm);
        showSuccess('Location updated successfully');
      } else {
        await api.post('/org/locations', locForm);
        showSuccess('Location created successfully');
      }
      setMasterModalType(null);
      setEditingItem(null);
      fetchLocations();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to save location');
    }
  };

  const handleDeleteLoc = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete location "${name}"?`)) return;
    try {
      await api.delete(`/org/locations/${id}`);
      showSuccess(`Location "${name}" deleted`);
      fetchLocations();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete location');
    }
  };

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/org/categories/${editingItem.id}`, catForm);
        showSuccess('Category updated successfully');
      } else {
        await api.post('/org/categories', catForm);
        showSuccess('Category created successfully');
      }
      setMasterModalType(null);
      setEditingItem(null);
      fetchCategories();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to save category');
    }
  };

  const handleDeleteCat = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      await api.delete(`/org/categories/${id}`);
      showSuccess(`Category "${name}" deleted`);
      fetchCategories();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleSaveVnd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/org/vendors/${editingItem.id}`, vndForm);
        showSuccess('Vendor updated successfully');
      } else {
        await api.post('/org/vendors', vndForm);
        showSuccess('Vendor registered successfully');
      }
      setMasterModalType(null);
      setEditingItem(null);
      fetchVendors();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to save vendor');
    }
  };

  const handleDeleteVnd = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete vendor "${name}"?`)) return;
    try {
      await api.delete(`/org/vendors/${id}`);
      showSuccess(`Vendor "${name}" deleted`);
      fetchVendors();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete vendor');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/system/settings');
      const settingsMap = new Map<string, string>(res.data.data.map((s: any) => [s.key, s.value]));

      let resolvedCompany = settingsMap.get('company.name') || globalBranding.companyName || 'Acme Global Technologies Inc.';
      let resolvedCurrency = settingsMap.get('company.currency') || globalBranding.currencyCode || 'USD';

      try {
        const orgRes = await api.get('/org/organization');
        if (orgRes.data?.data?.name) {
          resolvedCompany = orgRes.data.data.name;
          if (orgRes.data.data.currency) resolvedCurrency = orgRes.data.data.currency;
        }
      } catch {}

      setBranding((prev) => ({
        ...prev,
        companyName: resolvedCompany,
        address: settingsMap.get('company.address') || prev.address,
        email: settingsMap.get('company.email') || prev.email,
        phone: settingsMap.get('company.phone') || prev.phone,
        taxId: settingsMap.get('company.tax_id') || prev.taxId,
        currency: resolvedCurrency,
      }));

      if (settingsMap.has('asset.prefix')) {
        setNumbering({
          prefix: settingsMap.get('asset.prefix') || 'IT',
          padding: settingsMap.get('asset.padding') || '6',
          pattern: settingsMap.get('asset.pattern') || '{PREFIX}-{CATEGORY}-{NUMBER:6}',
          barcodeType: settingsMap.get('barcode.type') || 'CODE128',
        });
      }
    } catch (e) {}
  };

  const fetchEmailSettings = async () => {
    try {
      const res = await api.get('/system/email-settings');
      const data = res.data.data;
      setEmailConfig({
        provider: data.provider || 'custom',
        smtpHost: data.smtpHost || '',
        smtpPort: data.smtpPort || 587,
        smtpSecure: !!data.smtpSecure,
        smtpUser: data.smtpUser || '',
        smtpPass: data.smtpPass || '',
        fromName: data.fromName || 'IT Asset Management',
        fromEmail: data.fromEmail || '',
        enableTls: data.enableTls !== false,
        notificationsEnabled: data.notificationsEnabled !== false,
        notifyOnAllocation: data.notifyOnAllocation !== false,
        notifyOnReturn: data.notifyOnReturn !== false,
        notifyOnTicket: data.notifyOnTicket !== false,
        notifyOnMaintenance: data.notifyOnMaintenance !== false,
        notifyOnExpiry: data.notifyOnExpiry !== false,
        hasPassword: !!data.hasPassword,
      });
      if (data.fromEmail) {
        setTestRecipient(data.fromEmail);
      }
    } catch (e) {}
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/audit-logs');
      setAuditLogs(res.data.data);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await api.get('/health');
      setHealthStatus(res.data.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchSettings();
    fetchEmailSettings();
    fetchHealth();
  }, []);

  useEffect(() => {
    if (activeTab === 'email') fetchEmailSettings();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'health') fetchHealth();
    if (activeTab === 'masterData') fetchAllMasterData();
  }, [activeTab]);

  const handleProviderSelect = (prov: 'google_workspace' | 'office_365' | 'custom') => {
    if (prov === 'google_workspace') {
      setEmailConfig((prev) => ({
        ...prev,
        provider: 'google_workspace',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
        enableTls: true,
      }));
    } else if (prov === 'office_365') {
      setEmailConfig((prev) => ({
        ...prev,
        provider: 'office_365',
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecure: false,
        enableTls: true,
      }));
    } else {
      setEmailConfig((prev) => ({
        ...prev,
        provider: 'custom',
      }));
    }
  };

  const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    CNY: '¥',
    AED: 'AED',
    SGD: 'S$',
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const curCode = branding.currency.trim().toUpperCase() || 'USD';
      const curSymbol = CURRENCY_SYMBOLS[curCode] || '$';

      await Promise.all([
        api.put('/system/settings', [
          { key: 'company.name', value: branding.companyName, group: 'BRANDING' },
          { key: 'company.address', value: branding.address, group: 'BRANDING' },
          { key: 'company.email', value: branding.email, group: 'BRANDING' },
          { key: 'company.phone', value: branding.phone, group: 'BRANDING' },
          { key: 'company.tax_id', value: branding.taxId, group: 'BRANDING' },
          { key: 'company.currency', value: curCode, group: 'BRANDING' },
        ]),
        api.put('/org/organization', {
          name: branding.companyName,
          address: branding.address,
          email: branding.email,
          phone: branding.phone,
          taxId: branding.taxId,
          currency: curCode,
        }),
      ]);

      await updateBrandingContext({
        companyName: branding.companyName,
        currencyCode: curCode,
        currencySymbol: curSymbol,
      });
      updateUserOrganization(branding.companyName);
      await refreshBranding();
      setSaveSuccess(true);
      showSuccess('Company branding & organization profile saved successfully!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      showError('Failed to save branding settings');
    }
  };

  const handleSaveNumbering = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/system/settings', [
        { key: 'asset.prefix', value: numbering.prefix, group: 'ASSET_NUMBERING' },
        { key: 'asset.padding', value: numbering.padding, group: 'ASSET_NUMBERING' },
        { key: 'asset.pattern', value: numbering.pattern, group: 'ASSET_NUMBERING' },
        { key: 'barcode.type', value: numbering.barcodeType, group: 'BARCODE' },
      ]);
      setSaveSuccess(true);
      showSuccess('Asset numbering rules saved successfully!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      showError('Failed to save numbering settings');
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/system/email-settings', emailConfig);
      setSaveSuccess(true);
      showSuccess('Email server settings saved successfully!');
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchEmailSettings();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to save email settings');
    }
  };

  const handleSendTestEmail = async () => {
    if (!testRecipient) {
      showWarning('Please enter a recipient email address for testing.');
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await api.post('/system/email/test', {
        to: testRecipient,
        config: emailConfig,
      });
      setTestResult({
        success: true,
        message: res.data?.message || 'Test email successfully sent!',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || 'Failed to dispatch test email. Please check credentials and server logs.',
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <span>System Settings & Customization</span>
            <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-900">
              v3.0
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure company branding, barcode symbology, Google Workspace / Office 365 email dispatch, and audit trail
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings Saved Successfully</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6 overflow-x-auto">
          {[
            { id: 'branding', label: 'Company & Branding', icon: Building },
            { id: 'masterData', label: 'Organization & Master Data', icon: Building2 },
            { id: 'numbering', label: 'Asset Numbering & Barcodes', icon: Barcode },
            { id: 'email', label: 'Email Notifications (Google / Office 365)', icon: Mail },
            { id: 'audit', label: 'Immutable Audit Logs', icon: FileCheck },
            { id: 'health', label: 'System Engine & Diagnostics', icon: Server },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 text-xs font-semibold flex items-center space-x-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab: Company & Branding */}
      {activeTab === 'branding' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm max-w-2xl">
          <form onSubmit={handleSaveBranding} className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
              Branding Information
            </h3>
            <p className="text-slate-500 mb-4">
              This information automatically appears on generated PDF Handover certificates, return receipts, barcode labels, and email notices.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={branding.companyName}
                onChange={(e) => setBranding({ ...branding, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Headquarters Address
              </label>
              <textarea
                rows={2}
                value={branding.address}
                onChange={(e) => setBranding({ ...branding, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  IT Support Email
                </label>
                <input
                  type="email"
                  value={branding.email}
                  onChange={(e) => setBranding({ ...branding, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Support Telephone
                </label>
                <input
                  type="text"
                  value={branding.phone}
                  onChange={(e) => setBranding({ ...branding, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  GST / VAT / Tax ID
                </label>
                <input
                  type="text"
                  value={branding.taxId}
                  onChange={(e) => setBranding({ ...branding, taxId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Base Accounting Currency
                </label>
                <div className="flex space-x-2">
                  <select
                    value={['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'].includes((branding.currency || '').toUpperCase()) ? branding.currency.toUpperCase() : 'CUSTOM'}
                    onChange={(e) => {
                      if (e.target.value !== 'CUSTOM') {
                        setBranding({ ...branding, currency: e.target.value });
                      }
                    }}
                    className="w-1/2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs"
                  >
                    <option value="USD">$ - USD (US Dollar)</option>
                    <option value="EUR">€ - EUR (Euro)</option>
                    <option value="GBP">£ - GBP (British Pound)</option>
                    <option value="INR">₹ - INR (Indian Rupee)</option>
                    <option value="JPY">¥ - JPY (Japanese Yen)</option>
                    <option value="CAD">C$ - CAD (Canadian Dollar)</option>
                    <option value="AUD">A$ - AUD (Australian Dollar)</option>
                    <option value="CUSTOM">Custom Code...</option>
                  </select>
                  <input
                    type="text"
                    value={branding.currency}
                    onChange={(e) => setBranding({ ...branding, currency: e.target.value.toUpperCase() })}
                    placeholder="e.g. USD, INR"
                    className="w-1/2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg uppercase font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Save Branding Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Organization & Master Data */}
      {activeTab === 'masterData' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  <span>Master Data Entities & Hierarchy</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Manage core corporate metadata including department structures, office locations, asset categories, and approved hardware vendors.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setEditingItem(null);
                    if (masterSubTab === 'departments') {
                      setDeptForm({ name: '', code: '', departmentHead: '', costCenter: '' });
                      setMasterModalType('dept');
                    } else if (masterSubTab === 'locations') {
                      setLocForm({ name: '', code: '', type: 'OFFICE', address: '' });
                      setMasterModalType('loc');
                    } else if (masterSubTab === 'categories') {
                      setCatForm({ name: '', code: '', description: '' });
                      setMasterModalType('cat');
                    } else if (masterSubTab === 'vendors') {
                      setVndForm({ name: '', code: '', contactPerson: '', email: '', phone: '', website: '' });
                      setMasterModalType('vnd');
                    }
                  }}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    Add {masterSubTab === 'departments' ? 'Department' : masterSubTab === 'locations' ? 'Location' : masterSubTab === 'categories' ? 'Category' : 'Vendor'}
                  </span>
                </button>
              </div>
            </div>

            {/* Sub-tab pills */}
            <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              {[
                { id: 'departments', label: 'Departments', count: departments.length, icon: Building },
                { id: 'locations', label: 'Locations', count: locations.length, icon: MapPin },
                { id: 'categories', label: 'Asset Categories', count: categories.length, icon: Tag },
                { id: 'vendors', label: 'Vendors & Suppliers', count: vendors.length, icon: Truck },
              ].map((sub) => {
                const Icon = sub.icon;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setMasterSubTab(sub.id as any)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      masterSubTab === sub.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      masterSubTab === sub.id ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {sub.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Content for Departments */}
            {masterSubTab === 'departments' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Department Name</th>
                      <th className="py-2.5 px-3">Department Head</th>
                      <th className="py-2.5 px-3">Cost Center</th>
                      <th className="py-2.5 px-3">Assets</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {departments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">No departments configured</td>
                      </tr>
                    ) : (
                      departments.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{d.code}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{d.name}</td>
                          <td className="py-2.5 px-3 text-slate-500">{d.departmentHead || '—'}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{d.costCenter || '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                              {d._count?.assets || 0}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1">
                            <button
                              onClick={() => {
                                setEditingItem(d);
                                setDeptForm({
                                  name: d.name,
                                  code: d.code,
                                  departmentHead: d.departmentHead || '',
                                  costCenter: d.costCenter || '',
                                });
                                setMasterModalType('dept');
                              }}
                              className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Department"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDept(d.id, d.name)}
                              className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Delete Department"
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
            )}

            {/* Content for Locations */}
            {masterSubTab === 'locations' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Location Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Address</th>
                      <th className="py-2.5 px-3">Assets</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {locations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">No locations configured</td>
                      </tr>
                    ) : (
                      locations.map((loc) => (
                        <tr key={loc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{loc.code}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{loc.name}</td>
                          <td className="py-2.5 px-3 text-slate-500">{loc.type || 'OFFICE'}</td>
                          <td className="py-2.5 px-3 text-slate-500">{loc.address || '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                              {loc._count?.assets || 0}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1">
                            <button
                              onClick={() => {
                                setEditingItem(loc);
                                setLocForm({
                                  name: loc.name,
                                  code: loc.code,
                                  type: loc.type || 'OFFICE',
                                  address: loc.address || '',
                                });
                                setMasterModalType('loc');
                              }}
                              className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Location"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLoc(loc.id, loc.name)}
                              className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Delete Location"
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
            )}

            {/* Content for Categories */}
            {masterSubTab === 'categories' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Category Name</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Assets</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {categories.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 italic">No categories configured</td>
                      </tr>
                    ) : (
                      categories.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{c.code}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{c.name}</td>
                          <td className="py-2.5 px-3 text-slate-500">{c.description || '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                              {c._count?.assets || 0}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1">
                            <button
                              onClick={() => {
                                setEditingItem(c);
                                setCatForm({
                                  name: c.name,
                                  code: c.code,
                                  description: c.description || '',
                                });
                                setMasterModalType('cat');
                              }}
                              className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCat(c.id, c.name)}
                              className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Delete Category"
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
            )}

            {/* Content for Vendors */}
            {masterSubTab === 'vendors' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Vendor Name</th>
                      <th className="py-2.5 px-3">Contact Person</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Phone</th>
                      <th className="py-2.5 px-3">Assets</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {vendors.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 italic">No vendors configured</td>
                      </tr>
                    ) : (
                      vendors.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{v.code}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{v.name}</td>
                          <td className="py-2.5 px-3 text-slate-500">{v.contactPerson || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-500">{v.email || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-500">{v.phone || '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                              {v._count?.assets || 0}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1">
                            <button
                              onClick={() => {
                                setEditingItem(v);
                                setVndForm({
                                  name: v.name,
                                  code: v.code,
                                  contactPerson: v.contactPerson || '',
                                  email: v.email || '',
                                  phone: v.phone || '',
                                  website: v.website || '',
                                });
                                setMasterModalType('vnd');
                              }}
                              className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Vendor"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteVnd(v.id, v.name)}
                              className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Delete Vendor"
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
            )}
          </div>
        </div>
      )}

      {/* Tab: Asset Numbering & Barcodes */}
      {activeTab === 'numbering' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm max-w-2xl">
          <form onSubmit={handleSaveNumbering} className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
              Automated Asset Tag & Numbering Rule
            </h3>
            <p className="text-slate-500 mb-4">
              Configure sequential numbering rules applied to newly created IT equipment.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Asset Prefix
                </label>
                <input
                  type="text"
                  value={numbering.prefix}
                  onChange={(e) => setNumbering({ ...numbering, prefix: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg uppercase font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sequential Padding Digits
                </label>
                <input
                  type="number"
                  min={3}
                  max={8}
                  value={numbering.padding}
                  onChange={(e) => setNumbering({ ...numbering, padding: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Numbering Pattern Formula
              </label>
              <input
                type="text"
                value={numbering.pattern}
                onChange={(e) => setNumbering({ ...numbering, pattern: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Preview Example: IT-LAP-000001
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Barcode Symbology
              </label>
              <select
                value={numbering.barcodeType}
                onChange={(e) => setNumbering({ ...numbering, barcodeType: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="CODE128">Code 128 (High Density Alphanumeric)</option>
                <option value="CODE39">Code 39 (Standard Industrial)</option>
              </select>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Save Numbering Rules
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Email Notifications (Google Workspace & Office 365) */}
      {activeTab === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <form onSubmit={handleSaveEmail} className="space-y-6 text-xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Email Dispatch & Mailbox Settings
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Configure corporate SMTP delivery compatible with Google Workspace, Microsoft 365 / Office 365 Outlook, and custom relays.
                </p>
              </div>

              {/* Mail Provider Selector Cards */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Select Mail Infrastructure Provider *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Google Workspace */}
                  <div
                    onClick={() => handleProviderSelect('google_workspace')}
                    className={`cursor-pointer p-3.5 rounded-xl border text-left transition-all ${
                      emailConfig.provider === 'google_workspace'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        Google Workspace
                      </span>
                      {emailConfig.provider === 'google_workspace' && (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Gmail SMTP with App Passwords
                    </span>
                  </div>

                  {/* Office 365 Outlook */}
                  <div
                    onClick={() => handleProviderSelect('office_365')}
                    className={`cursor-pointer p-3.5 rounded-xl border text-left transition-all ${
                      emailConfig.provider === 'office_365'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        Microsoft 365
                      </span>
                      {emailConfig.provider === 'office_365' && (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Office 365 Outlook SMTP Relay
                    </span>
                  </div>

                  {/* Custom SMTP */}
                  <div
                    onClick={() => handleProviderSelect('custom')}
                    className={`cursor-pointer p-3.5 rounded-xl border text-left transition-all ${
                      emailConfig.provider === 'custom'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        Custom SMTP
                      </span>
                      {emailConfig.provider === 'custom' && (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Standard corporate relay / SendGrid
                    </span>
                  </div>
                </div>
              </div>

              {/* Provider Info Banner */}
              {emailConfig.provider === 'google_workspace' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg flex items-start space-x-2 text-[11px] text-amber-800 dark:text-amber-200">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <strong className="block font-semibold">Google Workspace 2FA App Password Required:</strong>
                    Do not use your personal Google account password. Navigate to <em>Google Account &gt; Security &gt; 2-Step Verification &gt; App Passwords</em>, create an app named "IT Asset Management", and paste the generated 16-character code into the password field below.
                  </div>
                </div>
              )}

              {emailConfig.provider === 'office_365' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg flex items-start space-x-2 text-[11px] text-blue-900 dark:text-blue-200">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                  <div>
                    <strong className="block font-semibold">Microsoft 365 Exchange SMTP AUTH:</strong>
                    Ensure <em>"Authenticated SMTP"</em> is enabled for this mailbox in the Microsoft 365 Admin Center under Active Users &gt; Mail &gt; Manage email apps. If Multi-Factor Authentication is enforced, use an App Password or service principal credentials.
                  </div>
                </div>
              )}

              {/* Host and Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Host Server *
                  </label>
                  <input
                    type="text"
                    required
                    value={emailConfig.smtpHost}
                    onChange={(e) => setEmailConfig({ ...emailConfig, smtpHost: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                    placeholder="e.g. smtp.gmail.com or smtp.office365.com"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Port *
                  </label>
                  <input
                    type="number"
                    required
                    value={emailConfig.smtpPort}
                    onChange={(e) => setEmailConfig({ ...emailConfig, smtpPort: parseInt(e.target.value, 10) || 587 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* User and Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Username / Mailbox Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={emailConfig.smtpUser}
                    onChange={(e) => setEmailConfig({ ...emailConfig, smtpUser: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    placeholder="it-notifications@yourdomain.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Password / App Password *
                    </label>
                    {emailConfig.hasPassword && (
                      <span className="text-[10px] text-emerald-600 font-semibold">
                        ✓ Password Configured
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={emailConfig.smtpPass}
                      onChange={(e) => setEmailConfig({ ...emailConfig, smtpPass: e.target.value })}
                      placeholder={emailConfig.hasPassword ? '•••••••• (leave blank to keep unchanged)' : 'Enter mailbox password or app code'}
                      className="w-full px-3 py-2 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sender Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sender Display Name
                  </label>
                  <input
                    type="text"
                    value={emailConfig.fromName}
                    onChange={(e) => setEmailConfig({ ...emailConfig, fromName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    placeholder="Acme IT Operations Helpdesk"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sender "From" Email Address
                  </label>
                  <input
                    type="email"
                    value={emailConfig.fromEmail}
                    onChange={(e) => setEmailConfig({ ...emailConfig, fromEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    placeholder="it-support@yourdomain.com"
                  />
                </div>
              </div>

              {/* Security & TLS Checkboxes */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200 dark:border-slate-800">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailConfig.notificationsEnabled}
                    onChange={(e) => setEmailConfig({ ...emailConfig, notificationsEnabled: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Enable System Email Notifications Globally
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailConfig.enableTls}
                      onChange={(e) => setEmailConfig({ ...emailConfig, enableTls: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-600 dark:text-slate-400">
                      Enforce STARTTLS / TLS Encryption (Recommended)
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailConfig.smtpSecure}
                      onChange={(e) => setEmailConfig({ ...emailConfig, smtpSecure: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-600 dark:text-slate-400">
                      Use Direct SSL (Port 465)
                    </span>
                  </label>
                </div>
              </div>

              {/* Event Triggers Checklist */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Automated Event Notification Triggers:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  {[
                    { key: 'notifyOnAllocation', label: 'Notify employee when IT equipment is allocated' },
                    { key: 'notifyOnReturn', label: 'Send return receipt when asset is checked back into stock' },
                    { key: 'notifyOnTicket', label: 'Notify requester on helpdesk ticket updates & SLA milestones' },
                    { key: 'notifyOnMaintenance', label: 'Notify technicians on maintenance schedule & repairs' },
                    { key: 'notifyOnExpiry', label: 'Send daily alerts when hardware warranties or AMC contracts expire' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(emailConfig as any)[item.key]}
                        onChange={(e) => setEmailConfig({ ...emailConfig, [item.key]: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-700 dark:text-slate-300 text-[11px]">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1.5"
                >
                  <Mail className="w-4 h-4" />
                  <span>Save Email Configuration</span>
                </button>
              </div>
            </form>
          </div>

          {/* Test Email & Diagnostics Panel */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 text-xs">
              <div className="flex items-center space-x-2">
                <Send className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 dark:text-slate-100">
                  Test SMTP Connection & Dispatch
                </h4>
              </div>
              <p className="text-slate-500 text-[11px]">
                Verify communication with Google Workspace or Office 365 by sending an immediate test email to your inbox.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Test Email Address:
                </label>
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="your-email@acme-corp.com"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <button
                type="button"
                disabled={testLoading}
                onClick={handleSendTestEmail}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold rounded-lg shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 transition-colors"
              >
                {testLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying SMTP Connection...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Dispatch Test Email</span>
                  </>
                )}
              </button>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-[11px] leading-relaxed ${
                    testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold mb-1">
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Test Email Successful</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>Connection Failed</span>
                      </>
                    )}
                  </div>
                  <p>{testResult.message}</p>
                </div>
              )}
            </div>

            {/* Quick Provider Reference */}
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-[11px] space-y-2 text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                Enterprise Email Setup Guide:
              </span>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>Google Workspace:</strong> Host <code>smtp.gmail.com</code>, Port <code>587</code> (STARTTLS), User = email, Password = 16-char App Password.
                </li>
                <li>
                  <strong>Microsoft 365:</strong> Host <code>smtp.office365.com</code>, Port <code>587</code>, User = user@org.onmicrosoft.com, TLS enabled.
                </li>
                <li>
                  <strong>Firewall:</strong> Ensure outbound TCP port 587 or 465 is unblocked.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Immutable Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Immutable System & Security Audit Trail
            </h3>
            <button
              onClick={fetchAuditLogs}
              className="p-1.5 text-slate-500 hover:text-blue-600 rounded"
              title="Refresh Logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No audit events recorded.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors font-mono"
                    >
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {log.username || 'System'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{log.entity}</td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-xs">
                        {log.entityId || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{log.ipAddress || '127.0.0.1'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: System Health & Engine */}
      {activeTab === 'health' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6 max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                System Diagnostics & Engine Status
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Live backend health metrics, database connection pool, memory footprint, and cron tasks
              </p>
            </div>
            <button
              type="button"
              onClick={fetchHealth}
              className="flex items-center space-x-1 px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
              <span className="text-slate-500 block">Overall Server Status</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{healthStatus?.status === 'UP' ? 'ONLINE & OPERATIONAL' : 'DIAGNOSING'}</span>
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
              <span className="text-slate-500 block">Database Connectivity</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{healthStatus?.database || 'CONNECTED'}</span>
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
              <span className="text-slate-500 block">Background Job Scheduler</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                {healthStatus?.scheduler?.jobsCount !== undefined
                  ? `${healthStatus.scheduler.jobsCount} Scheduled Tasks Active`
                  : 'Active Cron Engine'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
              <span className="text-slate-500 block">System Version</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center space-x-1.5">
                <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-xs font-mono">v{healthStatus?.version || '1.0.0'}</span>
                <span>Enterprise Edition</span>
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
              <span className="text-slate-500 block">Memory Footprint (RSS / Heap)</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 text-sm font-semibold">
                {healthStatus?.memoryUsage?.rss
                  ? `${Math.round(healthStatus.memoryUsage.rss / 1024 / 1024)} MB RSS / ${Math.round(healthStatus.memoryUsage.heapUsed / 1024 / 1024)} MB Heap`
                  : 'Normal / Optimized'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
              <span className="text-slate-500 block">Server Process Uptime</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 text-sm font-semibold">
                {healthStatus?.uptime
                  ? `${Math.floor(healthStatus.uptime / 3600)}h ${Math.floor((healthStatus.uptime % 3600) / 60)}m ${Math.floor(healthStatus.uptime % 60)}s`
                  : 'Active'}
              </span>
            </div>
          </div>

          {healthStatus?.timestamp && (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 text-right">
              Last probe telemetry: {new Date(healthStatus.timestamp).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Modal: Department */}
      <Modal
        isOpen={masterModalType === 'dept'}
        onClose={() => {
          setMasterModalType(null);
          setEditingItem(null);
        }}
        title={editingItem ? 'Edit Department' : 'Create New Department'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveDept} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Department Name *
            </label>
            <input
              type="text"
              required
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              placeholder="e.g. Information Technology"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Department Code *
            </label>
            <input
              type="text"
              required
              value={deptForm.code}
              onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. IT"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono uppercase"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Department Head (Optional)
            </label>
            <input
              type="text"
              value={deptForm.departmentHead}
              onChange={(e) => setDeptForm({ ...deptForm, departmentHead: e.target.value })}
              placeholder="e.g. Sarah Connor"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cost Center (Optional)
            </label>
            <input
              type="text"
              value={deptForm.costCenter}
              onChange={(e) => setDeptForm({ ...deptForm, costCenter: e.target.value })}
              placeholder="e.g. CC-101"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setMasterModalType(null);
                setEditingItem(null);
              }}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
            >
              {editingItem ? 'Update Department' : 'Create Department'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Location */}
      <Modal
        isOpen={masterModalType === 'loc'}
        onClose={() => {
          setMasterModalType(null);
          setEditingItem(null);
        }}
        title={editingItem ? 'Edit Location' : 'Register New Location'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveLoc} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Location Name *
            </label>
            <input
              type="text"
              required
              value={locForm.name}
              onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
              placeholder="e.g. San Francisco HQ"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Location Code *
              </label>
              <input
                type="text"
                required
                value={locForm.code}
                onChange={(e) => setLocForm({ ...locForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g. SF-HQ"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Location Type
              </label>
              <select
                value={locForm.type}
                onChange={(e) => setLocForm({ ...locForm, type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="OFFICE">Office</option>
                <option value="DATA_CENTER">Data Center</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="REMOTE">Remote Site</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Physical Address
            </label>
            <textarea
              rows={2}
              value={locForm.address}
              onChange={(e) => setLocForm({ ...locForm, address: e.target.value })}
              placeholder="e.g. 100 Innovation Blvd, Floor 5, San Francisco, CA"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setMasterModalType(null);
                setEditingItem(null);
              }}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
            >
              {editingItem ? 'Update Location' : 'Create Location'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Category */}
      <Modal
        isOpen={masterModalType === 'cat'}
        onClose={() => {
          setMasterModalType(null);
          setEditingItem(null);
        }}
        title={editingItem ? 'Edit Category' : 'Create Asset Category'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveCat} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              placeholder="e.g. Laptops & Ultrabooks"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Category Code *
            </label>
            <input
              type="text"
              required
              value={catForm.code}
              onChange={(e) => setCatForm({ ...catForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. LAPTOP"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono uppercase"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              placeholder="e.g. Portable computing hardware issued to staff"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setMasterModalType(null);
                setEditingItem(null);
              }}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
            >
              {editingItem ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Vendor */}
      <Modal
        isOpen={masterModalType === 'vnd'}
        onClose={() => {
          setMasterModalType(null);
          setEditingItem(null);
        }}
        title={editingItem ? 'Edit Vendor / Supplier' : 'Register New Vendor'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveVnd} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Vendor / Supplier Name *
            </label>
            <input
              type="text"
              required
              value={vndForm.name}
              onChange={(e) => setVndForm({ ...vndForm, name: e.target.value })}
              placeholder="e.g. Dell Enterprise Direct"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Vendor Code *
              </label>
              <input
                type="text"
                required
                value={vndForm.code}
                onChange={(e) => setVndForm({ ...vndForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g. DELL-CORP"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={vndForm.contactPerson}
                onChange={(e) => setVndForm({ ...vndForm, contactPerson: e.target.value })}
                placeholder="e.g. Michael Scott"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Support Email
              </label>
              <input
                type="email"
                value={vndForm.email}
                onChange={(e) => setVndForm({ ...vndForm, email: e.target.value })}
                placeholder="enterprise@dell.com"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={vndForm.phone}
                onChange={(e) => setVndForm({ ...vndForm, phone: e.target.value })}
                placeholder="+1 800 555 0199"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Website / Portal URL
            </label>
            <input
              type="text"
              value={vndForm.website}
              onChange={(e) => setVndForm({ ...vndForm, website: e.target.value })}
              placeholder="https://www.dell.com/premier"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setMasterModalType(null);
                setEditingItem(null);
              }}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
            >
              {editingItem ? 'Update Vendor' : 'Register Vendor'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
