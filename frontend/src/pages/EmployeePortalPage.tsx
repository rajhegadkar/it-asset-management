import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { AssetAssignment, Ticket } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { HandoverSignModal } from '../components/HandoverSignModal.js';
import { Modal } from '../components/Modal.js';
import { AssetTrackerModal } from '../components/AssetTrackerModal.js';
import {
  Laptop,
  Download,
  ShieldCheck,
  CheckCircle2,
  LifeBuoy,
  Plus,
  RefreshCw,
  Clock,
  HardDrive,
  Cpu,
  Search,
  Tag,
  X,
} from 'lucide-react';

export const EmployeePortalPage: React.FC = () => {
  const { user } = useAuth();

  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackTag, setTrackTag] = useState('');

  // Modals state
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssetAssignment | null>(null);

  const [ticketForm, setTicketForm] = useState({
    subject: '',
    description: '',
    category: 'HARDWARE',
    priority: 'MEDIUM',
    assetId: '',
  });

  const fetchMyData = async () => {
    setLoading(true);
    try {
      const empId = user?.employeeProfile?.id;
      if (empId) {
        const [asgRes, tktRes] = await Promise.all([
          api.get(`/allocations/assignments?employeeId=${empId}`),
          api.get(`/tickets?requesterId=${empId}`),
        ]);
        setAssignments(asgRes.data.data);
        setTickets(tktRes.data.data);
      }
    } catch (e) {
      console.error('Failed to load employee portal data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyData();
  }, [user]);

  const handleDownloadHandover = async (assignmentId: string, assetTag: string) => {
    try {
      const res = await api.get(`/allocations/handover-pdf/${assignmentId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `my-asset-handover-${assetTag}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to generate PDF document');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tickets', {
        ...ticketForm,
        requesterId: user?.employeeProfile?.id,
      });
      setTicketModalOpen(false);
      fetchMyData();
    } catch {
      alert('Failed to raise ticket');
    }
  };

  const filteredAssignments = assignments.filter((asg) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const tag = asg.asset?.assetTag?.toLowerCase() || '';
    const id = asg.asset?.assetId?.toLowerCase() || '';
    const name = asg.asset?.name?.toLowerCase() || '';
    const sn = asg.asset?.serialNumber?.toLowerCase() || '';
    return tag.includes(q) || id.includes(q) || name.includes(q) || sn.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Employee Self-Service Equipment Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review your assigned equipment custody, download handover receipts, and raise hardware support requests
          </p>
        </div>

        <button
          onClick={() => setTicketModalOpen(true)}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Report Issue / Support</span>
        </button>
      </div>

      {/* Assigned Assets List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Laptop className="w-4 h-4 text-blue-500" />
            <span>Currently Assigned Hardware in Your Custody ({assignments.length})</span>
          </h3>

          {assignments.length > 0 && (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tag, serial, or model..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
            <span>Loading equipment records...</span>
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500">
            No IT hardware assets currently registered to your profile.
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500">
            No equipment matches "{searchTerm}".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAssignments.map((asg) => (
              <div
                key={asg.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        {asg.asset?.assetTag || asg.asset?.assetId}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTrackTag(asg.asset?.assetTag || asg.asset?.assetId || '');
                          setTrackerOpen(true);
                        }}
                        className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded text-[11px] font-semibold border border-blue-200 dark:border-blue-800/60 inline-flex items-center space-x-1"
                        title="Track and inspect asset lifecycle"
                      >
                        <Tag className="w-3 h-3" />
                        <span>Track</span>
                      </button>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1.5">
                      {asg.asset?.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      S/N: {asg.asset?.serialNumber} • Allocated on:{' '}
                      {new Date(asg.allocationDate).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={asg.asset?.status || 'ASSIGNED'} />
                </div>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-400 block">CPU</span>
                    <span className="font-semibold">{asg.asset?.cpu || 'Standard Specs'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">RAM & Storage</span>
                    <span className="font-semibold">{asg.asset?.ram || '16GB'} • {asg.asset?.storage || '512GB'}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  {asg.termsAccepted ? (
                    <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      <span>Custody Acknowledged</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedAssignment(asg);
                        setSignModalOpen(true);
                      }}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Sign Handover Receipt</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDownloadHandover(asg.id, asg.asset?.assetTag)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tickets History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            My Support Requests & Tickets ({tickets.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Ticket #</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date Raised</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No support tickets requested.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {t.ticketNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {t.subject}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={t.priority} type="priority" />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sign Modal */}
      <HandoverSignModal
        isOpen={signModalOpen}
        onClose={() => setSignModalOpen(false)}
        assignment={selectedAssignment}
        onSignedSuccess={() => fetchMyData()}
      />

      {/* Raise Ticket Modal */}
      <Modal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Report IT Hardware / Software Issue"
        maxWidth="md"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Related Equipment
            </label>
            <select
              value={ticketForm.assetId}
              onChange={(e) => setTicketForm({ ...ticketForm, assetId: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="">-- General Issue / No specific asset --</option>
              {assignments.map((asg) => (
                <option key={asg.asset.id} value={asg.asset.id}>
                  [{asg.asset.assetTag || asg.asset.assetId}] {asg.asset.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject *
            </label>
            <input
              type="text"
              required
              value={ticketForm.subject}
              onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
              placeholder="e.g. Screen flickering or battery discharging rapidly"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description *
            </label>
            <textarea
              required
              rows={4}
              value={ticketForm.description}
              onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
              placeholder="Describe the issue and when it started occurring..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTicketModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              Submit Support Ticket
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
