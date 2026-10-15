import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { SoftwareLicense, Employee, Vendor } from '../types/index.js';
import { Modal } from '../components/Modal.js';
import { KeyRound, Plus, RefreshCw, Users, ShieldAlert, CheckCircle2, UserPlus, X, Edit2, Trash2 } from 'lucide-react';
import { useBranding } from '../customization/BrandingContext.js';

export const LicensesPage: React.FC = () => {
  const { branding, formatCurrency } = useBranding();
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<SoftwareLicense | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<SoftwareLicense | null>(null);

  const [licenseForm, setLicenseForm] = useState({
    softwareName: '',
    publisher: '',
    version: '',
    licenseType: 'PER_USER',
    licenseKey: '',
    quantityPurchased: 10,
    cost: '',
    expiryDate: '',
    vendorId: '',
  });

  const [editLicenseForm, setEditLicenseForm] = useState({
    softwareName: '',
    publisher: '',
    version: '',
    licenseType: 'PER_USER',
    licenseKey: '',
    quantityPurchased: 10,
    cost: '',
    expiryDate: '',
    vendorId: '',
    notes: '',
  });

  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    notes: '',
  });

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/licenses');
      setLicenses(res.data.data);
    } catch (err) {
      console.error('Failed to load software licenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [empRes, vndRes] = await Promise.all([
        api.get('/employees?limit=100'),
        api.get('/org/vendors'),
      ]);
      setEmployees(empRes.data.data);
      setVendors(vndRes.data.data);
      if (empRes.data.data.length > 0) {
        setAssignForm((prev) => ({ ...prev, employeeId: empRes.data.data[0].id }));
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchMasterData();
    fetchLicenses();
  }, []);

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/licenses', {
        ...licenseForm,
        cost: licenseForm.cost ? parseFloat(licenseForm.cost) : 0,
      });
      setCreateModalOpen(false);
      fetchLicenses();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create license');
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense) return;

    try {
      await api.post(`/licenses/${selectedLicense.id}/assign`, assignForm);
      setAssignModalOpen(false);
      fetchLicenses();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to assign license');
    }
  };

  const handleRevokeSeat = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to revoke this license seat?')) return;
    try {
      await api.delete(`/licenses/assignment/${assignmentId}`);
      fetchLicenses();
    } catch {
      alert('Failed to revoke license seat');
    }
  };

  const handleOpenEditLicense = (lic: SoftwareLicense) => {
    setEditingLicense(lic);
    setEditLicenseForm({
      softwareName: lic.softwareName,
      publisher: lic.publisher,
      version: lic.version || '',
      licenseType: lic.licenseType,
      licenseKey: lic.licenseKey || '',
      quantityPurchased: lic.quantityPurchased,
      cost: lic.cost ? String(lic.cost) : '',
      expiryDate: lic.expiryDate ? lic.expiryDate.split('T')[0] : '',
      vendorId: lic.vendorId || lic.vendor?.id || '',
      notes: lic.notes || '',
    });
    setEditModalOpen(true);
  };

  const handleUpdateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicense) return;
    try {
      await api.put(`/licenses/${editingLicense.id}`, {
        ...editLicenseForm,
        quantityPurchased: Number(editLicenseForm.quantityPurchased),
        cost: editLicenseForm.cost ? parseFloat(editLicenseForm.cost) : 0,
      });
      setEditModalOpen(false);
      setEditingLicense(null);
      fetchLicenses();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update license');
    }
  };

  const handleDeleteLicense = async (lic: SoftwareLicense) => {
    if ((lic.assignments || []).length > 0) {
      if (!confirm(`Warning: License "${lic.softwareName}" has ${lic.assignments?.length} active assigned seats. Deleting will revoke all assignments. Proceed?`)) return;
    } else {
      if (!confirm(`Are you sure you want to delete license "${lic.softwareName}"?`)) return;
    }
    try {
      await api.delete(`/licenses/${lic.id}`);
      fetchLicenses();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete license');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Software Asset Management (SAM) & Licenses
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track software compliance, cloud subscriptions, seat quotas, and per-user allocations
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add License</span>
        </button>
      </div>

      {/* Licenses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
            <span>Loading license contracts...</span>
          </div>
        ) : licenses.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            No software licenses found in registry.
          </div>
        ) : (
          licenses.map((lic) => {
            const seatsUsed = lic.quantityUsed || 0;
            const seatsTotal = lic.quantityPurchased || 1;
            const usagePercent = Math.min(100, Math.round((seatsUsed / seatsTotal) * 100));

            return (
              <div
                key={lic.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold">
                        {lic.licenseType}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {lic.softwareName}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {lic.publisher} • {lic.version || 'Latest'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleOpenEditLicense(lic)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Edit License"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLicense(lic)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Delete License"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Seat Utilization Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Seat Utilization</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {seatsUsed} / {seatsTotal} ({usagePercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          usagePercent >= 90
                            ? 'bg-rose-500'
                            : usagePercent >= 75
                            ? 'bg-amber-500'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </div>

                  {/* License Info */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Renewal / Expiry</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {lic.expiryDate ? new Date(lic.expiryDate).toLocaleDateString() : 'Perpetual'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Annual Cost</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(lic.cost)}
                      </span>
                    </div>
                  </div>

                  {/* Assigned Users list */}
                  {(lic.assignments || []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Assigned Users:
                      </span>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {(lic.assignments || []).map((asg) => (
                          <div
                            key={asg.id}
                            className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-800 rounded text-xs"
                          >
                            <span className="truncate">
                              {asg.employee?.firstName} {asg.employee?.lastName}
                            </span>
                            <button
                              onClick={() => handleRevokeSeat(asg.id)}
                              className="text-slate-400 hover:text-rose-500"
                              title="Revoke seat"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                  <button
                    disabled={seatsUsed >= seatsTotal}
                    onClick={() => {
                      setSelectedLicense(lic);
                      setAssignModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center space-x-1.5 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{seatsUsed >= seatsTotal ? 'All Seats Allocated' : 'Assign Seat to Employee'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create License Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register Software License (SAM)"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateLicense} className="space-y-4">
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Software Name *
                </label>
                <input
                  type="text"
                  required
                  value={licenseForm.softwareName}
                  onChange={(e) => setLicenseForm({ ...licenseForm, softwareName: e.target.value })}
                  placeholder="e.g. Adobe Creative Cloud All Apps"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Publisher / Vendor *
                </label>
                <input
                  type="text"
                  required
                  value={licenseForm.publisher}
                  onChange={(e) => setLicenseForm({ ...licenseForm, publisher: e.target.value })}
                  placeholder="e.g. Adobe Inc. / Microsoft"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  License Type
                </label>
                <select
                  value={licenseForm.licenseType}
                  onChange={(e) => setLicenseForm({ ...licenseForm, licenseType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="PER_USER">Per User</option>
                  <option value="PER_DEVICE">Per Device</option>
                  <option value="SUBSCRIPTION">Cloud Subscription</option>
                  <option value="PERPETUAL">Perpetual</option>
                  <option value="ENTERPRISE">Enterprise Site License</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Seats / Units Purchased *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={licenseForm.quantityPurchased}
                  onChange={(e) => setLicenseForm({ ...licenseForm, quantityPurchased: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  License Key / Activation Token
                </label>
                <input
                  type="text"
                  value={licenseForm.licenseKey}
                  onChange={(e) => setLicenseForm({ ...licenseForm, licenseKey: e.target.value })}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expiration / Renewal Date
                </label>
                <input
                  type="date"
                  value={licenseForm.expiryDate}
                  onChange={(e) => setLicenseForm({ ...licenseForm, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Annual Cost ({branding.currencySymbol || '$'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={licenseForm.cost}
                  onChange={(e) => setLicenseForm({ ...licenseForm, cost: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
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
              Save License Record
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign License Modal */}
      {selectedLicense && (
        <Modal
          isOpen={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          title={`Assign Seat: ${selectedLicense.softwareName}`}
          maxWidth="md"
        >
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Employee *
                </label>
                <select
                  required
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assignment Notes
                </label>
                <input
                  type="text"
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  placeholder="e.g. Design tool license for marketing sprint"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Assign Seat
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit License Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingLicense(null);
        }}
        title={`Edit Software License - ${editingLicense?.softwareName || ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateLicense} className="space-y-4">
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Software / Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={editLicenseForm.softwareName}
                  onChange={(e) => setEditLicenseForm({ ...editLicenseForm, softwareName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Publisher / Vendor *
                </label>
                <input
                  type="text"
                  required
                  value={editLicenseForm.publisher}
                  onChange={(e) => setEditLicenseForm({ ...editLicenseForm, publisher: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Software Version / Edition
                </label>
                <input
                  type="text"
                  value={editLicenseForm.version}
                  onChange={(e) => setEditLicenseForm({ ...editLicenseForm, version: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  License Model *
                </label>
                <select
                  value={editLicenseForm.licenseType}
                  onChange={(e) => setEditLicenseForm({ ...editLicenseForm, licenseType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="PER_USER">Per User (Named Seat)</option>
                  <option value="PER_DEVICE">Per Device (Node-Locked)</option>
                  <option value="SUBSCRIPTION">SaaS Subscription</option>
                  <option value="PERPETUAL">Perpetual (One-Time)</option>
                  <option value="CONCURRENT">Concurrent Network Floating</option>
                  <option value="ENTERPRISE">Enterprise Site License</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                License Key / Activation Serial
              </label>
              <input
                type="text"
                value={editLicenseForm.licenseKey}
                onChange={(e) => setEditLicenseForm({ ...editLicenseForm, licenseKey: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Total Seats Purchased *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editLicenseForm.quantityPurchased}
                  onChange={(e) => setEditLicenseForm({ ...editLicenseForm, quantityPurchased: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Total Cost ({branding.currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editLicenseForm.cost}
                  onChange={(e) => setEditLicenseForm({ ...editLicenseForm, cost: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expiration / Renewal
                </label>
                <input
                  type="date"
                  value={editLicenseForm.expiryDate}
                  onChange={(e) => setEditLicenseForm({ ...editLicenseForm, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Authorized Reseller / Vendor
              </label>
              <select
                value={editLicenseForm.vendorId}
                onChange={(e) => setEditLicenseForm({ ...editLicenseForm, vendorId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">-- Direct from Publisher --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Internal Contract Notes
              </label>
              <textarea
                rows={2}
                value={editLicenseForm.notes}
                onChange={(e) => setEditLicenseForm({ ...editLicenseForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setEditModalOpen(false);
                setEditingLicense(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              Update License
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
