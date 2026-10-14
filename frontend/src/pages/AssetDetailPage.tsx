import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Asset } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import {
  Laptop,
  ArrowLeft,
  Calendar,
  Shield,
  HardDrive,
  Cpu,
  Monitor,
  Printer,
  History,
  LifeBuoy,
  Wrench,
  User,
  ArrowRightLeft,
  CheckCircle2,
  Download,
  AlertCircle,
  Clock,
  Edit2,
  Save,
} from 'lucide-react';
import { CustomFieldDisplay } from '../customization/CustomFieldDisplay.js';
import { CustomFieldRenderer } from '../customization/CustomFieldRenderer.js';
import { Modal } from '../components/Modal.js';
import { useBranding } from '../customization/BrandingContext.js';

export const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatCurrency, formatDate } = useBranding();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'hardware' | 'assignments' | 'lifecycle' | 'maintenance' | 'tickets'>('overview');

  // Edit Asset Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);

  const handleOpenEditModal = () => {
    if (!asset) return;
    let initialCustom: Record<string, any> = {};
    try {
      if (asset.customFields) {
        initialCustom = typeof asset.customFields === 'string' ? JSON.parse(asset.customFields) : { ...asset.customFields };
      }
    } catch {}
    setEditCustomFields(initialCustom);
    setEditFormData({
      name: asset.name || '',
      categoryId: asset.categoryId || '',
      serialNumber: asset.serialNumber || '',
      manufacturer: asset.manufacturer || '',
      model: asset.model || '',
      status: asset.status || 'AVAILABLE',
      condition: asset.condition || 'GOOD',
      cpu: asset.cpu || '',
      ram: asset.ram || '',
      storage: asset.storage || '',
      operatingSystem: asset.operatingSystem || '',
      purchaseCost: asset.purchaseCost !== undefined && asset.purchaseCost !== null ? String(asset.purchaseCost) : '',
      warrantyEnd: asset.warrantyEnd ? asset.warrantyEnd.split('T')[0] : '',
      warrantyProvider: asset.warrantyProvider || '',
      hostname: asset.hostname || '',
      ipAddress: asset.ipAddress || '',
      notes: asset.notes || '',
    });
    setEditModalOpen(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;
    setEditSaving(true);
    try {
      await api.put(`/assets/${asset.id}`, {
        ...editFormData,
        purchaseCost: editFormData.purchaseCost ? parseFloat(editFormData.purchaseCost) : undefined,
        customFields: editCustomFields,
      });
      setEditModalOpen(false);
      await fetchAsset();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update asset');
    } finally {
      setEditSaving(false);
    }
  };

  const fetchAsset = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/assets/${id}`);
      setAsset(res.data.data);
    } catch {
      alert('Failed to load asset details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAsset();
  }, [id]);

  const handlePrintLabel = async () => {
    if (!asset) return;
    try {
      const res = await api.post(
        '/assets/labels/pdf',
        { assetIds: [asset.id] },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `label-${asset.assetTag}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to download barcode label');
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Loading asset specification...</div>;
  }

  if (!asset) {
    return <div className="p-12 text-center text-rose-500 text-sm">Asset record not found.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/assets')}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-600 dark:text-slate-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {asset.assetId}
              </span>
              <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                Tag: {asset.assetTag}
              </span>
              <StatusBadge status={asset.status} />
              <StatusBadge status={asset.condition} type="condition" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
              {asset.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {asset.status === 'AVAILABLE' && (
            <button
              onClick={() => navigate(`/allocations?action=allocate&assetId=${asset.id}`)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Allocate to Employee</span>
            </button>
          )}

          {asset.status === 'ASSIGNED' && (
            <button
              onClick={() => navigate(`/allocations?action=return&assetId=${asset.id}`)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Process Return</span>
            </button>
          )}

          <button
            onClick={handleOpenEditModal}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-sm"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Asset</span>
          </button>

          <button
            onClick={handlePrintLabel}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Label</span>
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'hardware', label: 'Hardware Specs' },
            { id: 'assignments', label: 'Custody & Handover' },
            { id: 'lifecycle', label: 'Lifecycle Timeline' },
            { id: 'maintenance', label: 'Maintenance Logs' },
            { id: 'tickets', label: 'Support Tickets' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-1 border-b-2 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Master Details Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                General Asset Information
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Asset ID</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {asset.assetId}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Asset Tag</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded inline-block">
                    {asset.assetTag}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Serial Number</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {asset.serialNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Category</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {asset.category?.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Department</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {asset.department?.name || 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Physical Location</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {asset.location?.name || 'HQ Building'}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial & Warranty Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Purchase & Warranty Contracts
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Purchase Cost</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatCurrency(asset.purchaseCost)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Purchase Date</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {formatDate(asset.purchaseDate)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Vendor</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {asset.vendor?.name || 'Direct'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Warranty Period</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {formatDate(asset.warrantyEnd)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Warranty Provider</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {asset.warrantyProvider || 'Manufacturer'}
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Dynamic Fields */}
            <CustomFieldDisplay
              customFields={asset.customFields}
              entity="ASSET"
              categoryId={asset.categoryId}
              onSave={async (newFields) => {
                await api.put(`/assets/${asset.id}`, { customFields: newFields });
                await fetchAsset();
              }}
            />
          </div>

          {/* Right Column: Custody Status & Quick Barcode Preview */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Current Custody
              </h4>
              {asset.currentEmployee ? (
                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                      {asset.currentEmployee.firstName[0]}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {asset.currentEmployee.firstName} {asset.currentEmployee.lastName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {asset.currentEmployee.designation || 'Staff'} • {asset.currentEmployee.employeeId}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/60 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <div>Email: {asset.currentEmployee.email}</div>
                    <div>Assigned on: {asset.assignmentDate ? new Date(asset.assignmentDate).toLocaleDateString() : ''}</div>
                    <div>Handover: <span className="font-semibold">{asset.handoverStatus || 'ACKNOWLEDGED'}</span></div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center text-xs text-slate-500">
                  Currently in inventory storage. Ready for allocation.
                </div>
              )}
            </div>

            {/* Printable Label Box */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm text-center space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Official Label & Barcode
              </h4>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center">
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                  {asset.assetId}
                </span>
                <span className="text-[10px] text-slate-500 mb-2">{asset.name}</span>
                <button
                  onClick={handlePrintLabel}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-xs font-medium hover:bg-slate-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Download PDF Label</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Hardware Specifications */}
      {activeTab === 'hardware' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Hardware & Technical Profile
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Manufacturer / Brand</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {asset.manufacturer || 'N/A'} {asset.model || ''}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">CPU / Processor</span>
              <span className="text-slate-800 dark:text-slate-200">{asset.cpu || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">RAM Memory</span>
              <span className="text-slate-800 dark:text-slate-200">{asset.ram || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Primary Storage</span>
              <span className="text-slate-800 dark:text-slate-200">{asset.storage || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Operating System</span>
              <span className="text-slate-800 dark:text-slate-200">{asset.operatingSystem || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Hostname</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{asset.hostname || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">IP Address</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{asset.ipAddress || 'DHCP'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">MAC Address</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{asset.macAddress || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Lifecycle Timeline */}
      {activeTab === 'lifecycle' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Immutable Asset Lifecycle History
          </h3>
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {(asset.lifecycleLogs || []).map((log, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                <div className="text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {log.eventType}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mt-1">{log.description}</p>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Operator: {log.performedBy || 'System'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Custody / Assignments */}
      {activeTab === 'assignments' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Historical Allocation Records
          </h3>
          <div className="space-y-3">
            {(asset.assignments || []).map((asg, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                    {asg.employee?.firstName} {asg.employee?.lastName} ({asg.employee?.employeeId})
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Allocation Type: {asg.allocationType} • Date:{' '}
                    {new Date(asg.allocationDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                      asg.status === 'ACTIVE'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {asg.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Maintenance Logs */}
      {activeTab === 'maintenance' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Maintenance & Repair History
          </h3>
          {(asset.maintenanceRecords || []).length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No maintenance records recorded.</p>
          ) : (
            <div className="space-y-3">
              {(asset.maintenanceRecords || []).map((mnt: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                    <span>{mnt.maintenanceType} Maintenance</span>
                    <span>Cost: ${mnt.cost || 0}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">Issue: {mnt.issue}</div>
                  <div className="text-slate-500 text-[11px]">
                    Work performed: {mnt.workPerformed || 'In Progress'} • Date:{' '}
                    {new Date(mnt.startDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Linked Support Tickets */}
      {activeTab === 'tickets' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Historical Support Tickets
          </h3>
          {(asset.tickets || []).length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No support tickets linked to this asset.</p>
          ) : (
            <div className="space-y-3">
              {(asset.tickets || []).map((t: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      {t.ticketNumber}: {t.subject}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Requester: {t.requester?.firstName} {t.requester?.lastName} • Priority: {t.priority}
                    </span>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Asset Modal */}
      {asset && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={`Edit Asset Details & Attributes — ${asset.assetTag || asset.assetId}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveAsset} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Asset Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Serial Number *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.serialNumber || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, serialNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Manufacturer / Brand
                </label>
                <input
                  type="text"
                  value={editFormData.manufacturer || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, manufacturer: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Model Specification
                </label>
                <input
                  type="text"
                  value={editFormData.model || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={editFormData.status || 'AVAILABLE'}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="AVAILABLE">AVAILABLE (In Stock)</option>
                  <option value="ASSIGNED">ASSIGNED (In Use)</option>
                  <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
                  <option value="REPAIR">REPAIR</option>
                  <option value="RETIRED">RETIRED</option>
                  <option value="DAMAGED">DAMAGED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Condition
                </label>
                <select
                  value={editFormData.condition || 'GOOD'}
                  onChange={(e) => setEditFormData({ ...editFormData, condition: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="NEW">NEW</option>
                  <option value="EXCELLENT">EXCELLENT</option>
                  <option value="GOOD">GOOD</option>
                  <option value="FAIR">FAIR</option>
                  <option value="POOR">POOR</option>
                  <option value="DAMAGED">DAMAGED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  CPU / Processor
                </label>
                <input
                  type="text"
                  value={editFormData.cpu || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, cpu: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  RAM Memory
                </label>
                <input
                  type="text"
                  value={editFormData.ram || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, ram: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Storage
                </label>
                <input
                  type="text"
                  value={editFormData.storage || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, storage: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Operating System
                </label>
                <input
                  type="text"
                  value={editFormData.operatingSystem || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, operatingSystem: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Purchase Cost
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.purchaseCost || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, purchaseCost: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Warranty End Date
                </label>
                <input
                  type="date"
                  value={editFormData.warrantyEnd || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, warrantyEnd: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            {/* Custom Specifications in Edit Asset Modal */}
            <div className="pt-2">
              <CustomFieldRenderer
                entity="ASSET"
                values={editCustomFields}
                onChange={setEditCustomFields}
                categoryId={asset.categoryId}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{editSaving ? 'Saving Changes...' : 'Save Asset Changes'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
