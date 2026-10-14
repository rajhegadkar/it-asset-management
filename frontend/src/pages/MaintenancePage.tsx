import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { Asset, Vendor } from '../types/index.js';
import { Modal } from '../components/Modal.js';
import { AssetTrackerModal } from '../components/AssetTrackerModal.js';
import { Wrench, Plus, RefreshCw, CheckCircle2, AlertCircle, Clock, Search, Tag, X } from 'lucide-react';
import { CustomFieldRenderer } from '../customization/CustomFieldRenderer.js';
import { useBranding } from '../customization/BrandingContext.js';

export const MaintenancePage: React.FC = () => {
  const { branding, formatCurrency } = useBranding();
  const [records, setRecords] = useState<any[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [assetFilterSearch, setAssetFilterSearch] = useState('');
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackTag, setTrackTag] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Forms state
  const [scheduleForm, setScheduleForm] = useState({
    assetId: '',
    maintenanceType: 'CORRECTIVE',
    vendorId: '',
    engineerName: '',
    startDate: new Date().toISOString().split('T')[0],
    issue: '',
    notes: '',
  });

  const [completeForm, setCompleteForm] = useState({
    endDate: new Date().toISOString().split('T')[0],
    workPerformed: '',
    partsReplaced: '',
    cost: '',
    downtimeHours: '',
  });

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get('/maintenance');
      setRecords(res.data.data);
    } catch (err) {
      console.error('Failed to load maintenance records:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [astRes, vndRes] = await Promise.all([
        api.get('/assets?limit=100'),
        api.get('/org/vendors'),
      ]);
      setAssets(astRes.data.data);
      setVendors(vndRes.data.data);
      if (astRes.data.data.length > 0) {
        setScheduleForm((prev: any) => ({ ...prev, assetId: astRes.data.data[0].id }));
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchMasterData();
    fetchRecords();
  }, []);

  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/maintenance', {
        ...scheduleForm,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      });
      setCreateModalOpen(false);
      setCustomFields({});
      fetchRecords();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to schedule maintenance');
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId) return;

    try {
      await api.put(`/maintenance/${selectedRecordId}/complete`, {
        ...completeForm,
        cost: completeForm.cost ? parseFloat(completeForm.cost) : 0,
        downtimeHours: completeForm.downtimeHours ? parseFloat(completeForm.downtimeHours) : 0,
      });
      setCompleteModalOpen(false);
      fetchRecords();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to complete maintenance');
    }
  };

  const filteredRecords = records.filter((rec: any) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const tag = (rec.asset?.assetTag || '').toLowerCase();
    const id = (rec.asset?.assetId || '').toLowerCase();
    const name = (rec.asset?.name || '').toLowerCase();
    const serial = (rec.asset?.serialNumber || '').toLowerCase();
    const issue = (rec.issue || '').toLowerCase();
    const vendor = (rec.vendor?.name || '').toLowerCase();
    const engineer = (rec.engineerName || '').toLowerCase();
    return (
      tag.includes(q) ||
      id.includes(q) ||
      name.includes(q) ||
      serial.includes(q) ||
      issue.includes(q) ||
      vendor.includes(q) ||
      engineer.includes(q)
    );
  });

  const filteredAssets = assets.filter((a: Asset) => {
    if (!assetFilterSearch.trim()) return true;
    const q = assetFilterSearch.toLowerCase();
    return (
      (a.assetTag && a.assetTag.toLowerCase().includes(q)) ||
      a.assetId.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.serialNumber.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Maintenance, Repairs & Service History
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track preventive servicing, hardware repair downtime, vendor work orders, and parts replacement
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Service</span>
        </button>
      </div>

      {/* Records Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Search Bar for Maintenance Records */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search maintenance by Asset Tag, Serial, Issue, Vendor..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing {filteredRecords.length} of {records.length} records
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Asset Details & Tag</th>
                <th className="py-3 px-4">Maintenance Type</th>
                <th className="py-3 px-4">Issue / Reason</th>
                <th className="py-3 px-4">Technician / Vendor</th>
                <th className="py-3 px-4">Start Date</th>
                <th className="py-3 px-4">Cost ({branding.currencySymbol || '$'})</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading maintenance logs...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    {searchTerm ? `No records matching "${searchTerm}"` : 'No maintenance records found.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec: any) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex items-center space-x-1.5 mb-1">
                        <span className="font-bold text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                          {rec.asset?.assetTag || rec.asset?.assetId}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTrackTag(rec.asset?.assetTag || rec.asset?.assetId);
                            setTrackerOpen(true);
                          }}
                          title="Track this asset"
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                          <Search className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-slate-800 dark:text-slate-200 font-sans font-semibold block">
                        {rec.asset?.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans block">
                        ID: {rec.asset?.assetId} • S/N: {rec.asset?.serialNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      {rec.maintenanceType}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400">
                      {rec.issue}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {rec.vendor?.name || rec.engineerName || 'Internal IT'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(rec.startDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(rec.cost)}
                    </td>
                    <td className="py-3.5 px-4">
                      {rec.endDate ? (
                        <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 mr-1" />
                          In Progress
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {!rec.endDate && (
                        <button
                          onClick={() => {
                            setSelectedRecordId(rec.id);
                            setCompleteModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-sm"
                        >
                          Mark Done
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Maintenance Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Schedule Hardware Service / Maintenance"
        maxWidth="lg"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Equipment by Asset Tag / Name *
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={assetFilterSearch}
                  onChange={(e) => setAssetFilterSearch(e.target.value)}
                  placeholder="Filter equipment by Asset Tag, Serial, or Model..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
              <select
                required
                value={scheduleForm.assetId}
                onChange={(e) => setScheduleForm({ ...scheduleForm, assetId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs"
              >
                <option value="">-- Choose Asset from Inventory ({filteredAssets.length}) --</option>
                {filteredAssets.map((a: Asset) => (
                  <option key={a.id} value={a.id}>
                    [{a.assetTag || a.assetId}] {a.name} ({a.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Maintenance Type
                </label>
                <select
                  value={scheduleForm.maintenanceType}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, maintenanceType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="PREVENTIVE">Preventive Maintenance</option>
                  <option value="CORRECTIVE">Corrective Repair</option>
                  <option value="EMERGENCY">Emergency Breakdown</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={scheduleForm.startDate}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Service Vendor
                </label>
                <select
                  value={scheduleForm.vendorId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, vendorId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- Internal IT / In-House --</option>
                  {vendors.map((v: Vendor) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Engineer Name
                </label>
                <input
                  type="text"
                  value={scheduleForm.engineerName}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, engineerName: e.target.value })}
                  placeholder="e.g. Dell Certified Technician"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Issue Description *
              </label>
              <textarea
                required
                rows={3}
                value={scheduleForm.issue}
                onChange={(e) => setScheduleForm({ ...scheduleForm, issue: e.target.value })}
                placeholder="Details of symptoms, hardware failures, or scheduled inspection..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            {/* Custom Specifications for Maintenance */}
            <div className="pt-2">
              <CustomFieldRenderer
                entity="MAINTENANCE"
                values={customFields}
                onChange={setCustomFields}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              Dispatch Work Order
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete Maintenance Modal */}
      <Modal
        isOpen={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Complete Service & Restore Asset"
        maxWidth="md"
      >
        <form onSubmit={handleCompleteSubmit} className="space-y-4">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Completion Date *
              </label>
              <input
                type="date"
                required
                value={completeForm.endDate}
                onChange={(e) => setCompleteForm({ ...completeForm, endDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Work Performed Summary
              </label>
              <textarea
                rows={3}
                value={completeForm.workPerformed}
                onChange={(e) => setCompleteForm({ ...completeForm, workPerformed: e.target.value })}
                placeholder="e.g. Replaced LCD panel and thermal paste, passed hardware diagnostic..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Service Cost ({branding.currencySymbol || '$'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={completeForm.cost}
                  onChange={(e) => setCompleteForm({ ...completeForm, cost: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Downtime (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={completeForm.downtimeHours}
                  onChange={(e) => setCompleteForm({ ...completeForm, downtimeHours: e.target.value })}
                  placeholder="24"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCompleteModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              Mark Completed & Restore Asset
            </button>
          </div>
        </form>
      </Modal>

      {/* Asset Tracker Modal */}
      <AssetTrackerModal
        isOpen={trackerOpen}
        onClose={() => setTrackerOpen(false)}
        initialQuery={trackTag}
      />
    </div>
  );
};
