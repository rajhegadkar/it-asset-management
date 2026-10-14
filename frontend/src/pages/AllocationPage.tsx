import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Asset, Employee, AssetAssignment } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import { HandoverSignModal } from '../components/HandoverSignModal.js';
import { AssetTrackerModal } from '../components/AssetTrackerModal.js';
import {
  ArrowRightLeft,
  CheckCircle2,
  Download,
  Plus,
  RefreshCw,
  Search,
  FileCheck,
  RotateCcw,
  Send,
  ShieldCheck,
  Tag,
  X,
  Eye,
} from 'lucide-react';

const COMMON_ACCESSORIES = [
  'Original Laptop Charger',
  'Wireless Optical Mouse',
  'USB-C Docking Station',
  'Targus Laptop Carrying Bag',
  'HDMI / DisplayPort Cable',
  'Noise Cancelling Headset',
  'Apple MagSafe 3 Cable',
];

export const AllocationPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [returnAssetSearchQuery, setReturnAssetSearchQuery] = useState('');
  const [transferAssetSearchQuery, setTransferAssetSearchQuery] = useState('');
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackTag, setTrackTag] = useState('');

  // Modals state
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssetAssignment | null>(null);

  // Form State: Allocate
  const [allocForm, setAllocForm] = useState({
    assetId: '',
    employeeId: '',
    allocationType: 'PERMANENT',
    accessories: ['Original Laptop Charger', 'Wireless Optical Mouse'],
    expectedReturnDate: '',
    notes: '',
  });

  // Form State: Return
  const [returnForm, setReturnForm] = useState({
    assetId: '',
    condition: 'GOOD',
    damageNotes: '',
    missingAccessories: [] as string[],
    newStatus: 'AVAILABLE',
    notes: '',
  });

  // Form State: Transfer
  const [transferForm, setTransferForm] = useState({
    assetId: '',
    toEmployeeId: '',
    reason: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [asgRes, astRes, empRes] = await Promise.all([
        api.get('/allocations/assignments'),
        api.get('/assets?status=AVAILABLE&limit=100'),
        api.get('/employees?limit=100'),
      ]);
      setAssignments(asgRes.data.data);
      setAvailableAssets(astRes.data.data);
      setEmployees(empRes.data.data);
    } catch (err) {
      console.error('Failed to load allocation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Check URL parameters for direct triggers from scanner
    const action = searchParams.get('action');
    const assetId = searchParams.get('assetId');
    if (action === 'allocate' && assetId) {
      setAllocForm((prev) => ({ ...prev, assetId }));
      setAllocateModalOpen(true);
    } else if (action === 'return' && assetId) {
      setReturnForm((prev) => ({ ...prev, assetId }));
      setReturnModalOpen(true);
    }
  }, [searchParams]);

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/allocations/allocate', allocForm);
      setAllocateModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to allocate asset');
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/allocations/return', returnForm);
      setReturnModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to return asset');
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/allocations/transfer', transferForm);
      setTransferModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to transfer asset');
    }
  };

  const handleDownloadHandover = async (assignmentId: string, assetTag: string) => {
    try {
      const res = await api.get(`/allocations/handover-pdf/${assignmentId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `handover-${assetTag}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to download certificate');
    }
  };

  const filteredAssignments = assignments.filter((asg) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const tag = (asg.asset?.assetTag || '').toLowerCase();
    const assetId = (asg.asset?.assetId || '').toLowerCase();
    const serial = (asg.asset?.serialNumber || '').toLowerCase();
    const name = (asg.asset?.name || '').toLowerCase();
    const empName = `${asg.employee?.firstName || ''} ${asg.employee?.lastName || ''}`.toLowerCase();
    const empId = (asg.employee?.employeeId || '').toLowerCase();
    return (
      tag.includes(q) ||
      assetId.includes(q) ||
      serial.includes(q) ||
      name.includes(q) ||
      empName.includes(q) ||
      empId.includes(q)
    );
  });

  const filteredAvailableAssets = availableAssets.filter((a) => {
    if (!assetSearchQuery.trim()) return true;
    const q = assetSearchQuery.toLowerCase();
    return (
      (a.assetTag && a.assetTag.toLowerCase().includes(q)) ||
      a.assetId.toLowerCase().includes(q) ||
      a.serialNumber.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q)
    );
  });

  const filteredReturnAssets = assignments.filter((asg) => {
    if (!returnAssetSearchQuery.trim()) return true;
    const q = returnAssetSearchQuery.toLowerCase();
    const tag = (asg.asset?.assetTag || '').toLowerCase();
    const id = asg.asset?.assetId?.toLowerCase() || '';
    const serial = asg.asset?.serialNumber?.toLowerCase() || '';
    const name = asg.asset?.name?.toLowerCase() || '';
    const emp = `${asg.employee?.firstName} ${asg.employee?.lastName}`.toLowerCase();
    return tag.includes(q) || id.includes(q) || serial.includes(q) || name.includes(q) || emp.includes(q);
  });

  const filteredTransferAssets = assignments.filter((asg) => {
    if (!transferAssetSearchQuery.trim()) return true;
    const q = transferAssetSearchQuery.toLowerCase();
    const tag = (asg.asset?.assetTag || '').toLowerCase();
    const id = asg.asset?.assetId?.toLowerCase() || '';
    const serial = asg.asset?.serialNumber?.toLowerCase() || '';
    const name = asg.asset?.name?.toLowerCase() || '';
    const emp = `${asg.employee?.firstName} ${asg.employee?.lastName}`.toLowerCase();
    return tag.includes(q) || id.includes(q) || serial.includes(q) || name.includes(q) || emp.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Custody, Allocations & Handover
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track active employee custodianship, digital sign-off compliance, returns, and transfers
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTransferModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-sm"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transfer Asset</span>
          </button>

          <button
            onClick={() => setReturnModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
            <span>Process Return</span>
          </button>

          <button
            onClick={() => setAllocateModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Allocation</span>
          </button>
        </div>
      </div>

      {/* Active Assignments Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Current Custody & Handover Register
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {assignments.length} total active records
          </span>
        </div>

        {/* Search Bar for Custody Assignments */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter custody by Asset Tag, Serial, Employee, or ID..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing {filteredAssignments.length} of {assignments.length} assignments
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Asset Details & Tag</th>
                <th className="py-3 px-4">Employee Recipient</th>
                <th className="py-3 px-4">Allocation Type</th>
                <th className="py-3 px-4">Issued Date</th>
                <th className="py-3 px-4">Digital Sign-off</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading custody records...</span>
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    {searchQuery ? `No assignments matching "${searchQuery}"` : 'No active asset custody assignments found.'}
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((asg) => (
                  <tr
                    key={asg.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex items-center space-x-1.5 mb-1">
                        <span className="font-bold text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                          {asg.asset?.assetTag || asg.asset?.assetId}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTrackTag(asg.asset?.assetTag || asg.asset?.assetId);
                            setTrackerOpen(true);
                          }}
                          title="Track this asset tag"
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                          <Search className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-900 dark:text-slate-100 font-sans block font-semibold">
                        {asg.asset?.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans block">
                        ID: {asg.asset?.assetId} • S/N: {asg.asset?.serialNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                        {asg.employee?.firstName} {asg.employee?.lastName}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {asg.employee?.employeeId} • {asg.employee?.department?.name || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      {asg.allocationType}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {new Date(asg.allocationDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      {asg.termsAccepted ? (
                        <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          <span>Acknowledged</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedAssignment(asg);
                            setSignModalOpen(true);
                          }}
                          className="inline-flex items-center text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 hover:bg-amber-100"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          <span>Sign Receipt</span>
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleDownloadHandover(asg.id, asg.asset?.assetTag)}
                        title="Download Handover Certificate PDF"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-block"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocate Modal */}
      <Modal
        isOpen={allocateModalOpen}
        onClose={() => setAllocateModalOpen(false)}
        title="Allocate IT Equipment to Employee"
        maxWidth="xl"
      >
        <form onSubmit={handleAllocateSubmit} className="space-y-4">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Available Equipment by Asset Tag / Name *
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  placeholder="Filter available equipment by Asset Tag, Serial, or Model..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
              <select
                required
                value={allocForm.assetId}
                onChange={(e) => setAllocForm({ ...allocForm, assetId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs"
              >
                <option value="">-- Choose Asset from In-Stock Inventory ({filteredAvailableAssets.length}) --</option>
                {filteredAvailableAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.assetTag || a.assetId}] {a.name} (S/N: {a.serialNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Employee Custodian *
              </label>
              <select
                required
                value={allocForm.employeeId}
                onChange={(e) => setAllocForm({ ...allocForm, employeeId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="">-- Choose Employee --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.employeeId}) - {e.department?.name || 'General'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Allocation Type
                </label>
                <select
                  value={allocForm.allocationType}
                  onChange={(e) => setAllocForm({ ...allocForm, allocationType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="PERMANENT">Permanent Deployment</option>
                  <option value="TEMPORARY">Temporary / Short Term</option>
                  <option value="PROJECT">Project Specific</option>
                  <option value="LOANER">Loaner Unit</option>
                  <option value="REMOTE_WORK">Remote Work (WFH)</option>
                  <option value="REPLACEMENT">Hardware Replacement</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expected Return Date
                </label>
                <input
                  type="date"
                  value={allocForm.expectedReturnDate}
                  onChange={(e) => setAllocForm({ ...allocForm, expectedReturnDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            {/* Accessories Checklist */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Included Accessories & Peripherals:
              </label>
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {COMMON_ACCESSORIES.map((item) => (
                  <label key={item} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allocForm.accessories.includes(item)}
                      onChange={(e) => {
                        const acc = allocForm.accessories;
                        if (e.target.checked) {
                          setAllocForm({ ...allocForm, accessories: [...acc, item] });
                        } else {
                          setAllocForm({ ...allocForm, accessories: acc.filter((x) => x !== item) });
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300 text-[11px]">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setAllocateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              Issue Asset & Notify Employee
            </button>
          </div>
        </form>
      </Modal>

      {/* Return Modal */}
      <Modal
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title="Process Asset Return to Inventory"
        maxWidth="lg"
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Asset to Return by Asset Tag *
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={returnAssetSearchQuery}
                  onChange={(e) => setReturnAssetSearchQuery(e.target.value)}
                  placeholder="Filter by Asset Tag, ID, or Custodian..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
              <select
                required
                value={returnForm.assetId}
                onChange={(e) => setReturnForm({ ...returnForm, assetId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs"
              >
                <option value="">-- Choose Currently Assigned Asset ({filteredReturnAssets.length}) --</option>
                {filteredReturnAssets.map((asg) => (
                  <option key={asg.asset.id} value={asg.asset.id}>
                    [{asg.asset.assetTag || asg.asset.assetId}] {asg.asset.name} (Held by {asg.employee.firstName}{' '}
                    {asg.employee.lastName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assessed Hardware Condition *
              </label>
              <select
                value={returnForm.condition}
                onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="EXCELLENT">Excellent (Like New)</option>
                <option value="GOOD">Good (Normal wear)</option>
                <option value="FAIR">Fair (Minor scuffs / scratches)</option>
                <option value="DAMAGED">Damaged (Requires technician service)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Damage Notes / Physical Assessment
              </label>
              <textarea
                value={returnForm.damageNotes}
                onChange={(e) => setReturnForm({ ...returnForm, damageNotes: e.target.value })}
                placeholder="Describe any hardware faults, missing parts, or screen scratches..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setReturnModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              Accept Return & Restore Stock
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Asset Custody by Asset Tag"
        maxWidth="md"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Asset to Transfer *
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={transferAssetSearchQuery}
                  onChange={(e) => setTransferAssetSearchQuery(e.target.value)}
                  placeholder="Filter by Asset Tag, Serial, or Employee..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
              <select
                required
                value={transferForm.assetId}
                onChange={(e) => setTransferForm({ ...transferForm, assetId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs"
              >
                <option value="">-- Choose Asset ({filteredTransferAssets.length}) --</option>
                {filteredTransferAssets.map((asg) => (
                  <option key={asg.asset.id} value={asg.asset.id}>
                    [{asg.asset.assetTag || asg.asset.assetId}] {asg.asset.name} (from {asg.employee.firstName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Transfer To Employee *
              </label>
              <select
                required
                value={transferForm.toEmployeeId}
                onChange={(e) => setTransferForm({ ...transferForm, toEmployeeId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">-- Choose Recipient Employee --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Transfer *
              </label>
              <input
                type="text"
                required
                value={transferForm.reason}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                placeholder="e.g. Department project realignment"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTransferModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              Execute Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* Digital Sign Modal */}
      <HandoverSignModal
        isOpen={signModalOpen}
        onClose={() => setSignModalOpen(false)}
        assignment={selectedAssignment}
        onSignedSuccess={() => fetchData()}
      />

      {/* Quick Asset Tracker Modal */}
      <AssetTrackerModal
        isOpen={trackerOpen}
        onClose={() => setTrackerOpen(false)}
        initialQuery={trackTag}
      />
    </div>
  );
};

