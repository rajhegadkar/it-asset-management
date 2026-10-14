import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Ticket, Employee, Asset } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import { AssetTrackerModal } from '../components/AssetTrackerModal.js';
import { useAuth } from '../context/AuthContext.js';
import {
  LifeBuoy,
  Plus,
  RefreshCw,
  Clock,
  MessageSquare,
  Send,
  AlertCircle,
  User,
  Laptop,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { CustomFieldRenderer } from '../customization/CustomFieldRenderer.js';
import { CustomFieldDisplay } from '../customization/CustomFieldDisplay.js';

export const TicketsPage: React.FC = () => {
  const { user } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [ticketAssetSearch, setTicketAssetSearch] = useState('');
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackTag, setTrackTag] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newComment, setNewComment] = useState('');

  // Master options
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [ticketForm, setTicketForm] = useState({
    subject: '',
    description: '',
    category: 'HARDWARE',
    priority: 'MEDIUM',
    requesterId: '',
    assetId: '',
  });

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const res = await api.get('/tickets', { params });
      setTickets(res.data.data);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [empRes, astRes] = await Promise.all([
        api.get('/employees?limit=100'),
        api.get('/assets?limit=100'),
      ]);
      setEmployees(empRes.data.data);
      setAssets(astRes.data.data);
      if (empRes.data.data.length > 0) {
        setTicketForm((prev) => ({ ...prev, requesterId: empRes.data.data[0].id }));
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter]);

  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tickets', {
        ...ticketForm,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      });
      setCreateModalOpen(false);
      setCustomFields({});
      fetchTickets();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create ticket');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newComment.trim()) return;

    try {
      await api.post(`/tickets/${selectedTicket.id}/comments`, {
        comment: newComment.trim(),
      });
      setNewComment('');
      // Refresh ticket details
      const updated = await api.get(`/tickets/${selectedTicket.id}`);
      setSelectedTicket(updated.data.data);
      fetchTickets();
    } catch {
      alert('Failed to post comment');
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicket) return;
    try {
      await api.put(`/tickets/${selectedTicket.id}`, { status });
      const updated = await api.get(`/tickets/${selectedTicket.id}`);
      setSelectedTicket(updated.data.data);
      fetchTickets();
    } catch {
      alert('Failed to update ticket status');
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const tNum = (t.ticketNumber || '').toLowerCase();
    const subj = (t.subject || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const tag = (t.asset?.assetTag || '').toLowerCase();
    const assetId = (t.asset?.assetId || '').toLowerCase();
    const assetName = (t.asset?.name || '').toLowerCase();
    const reqName = `${t.requester?.firstName || ''} ${t.requester?.lastName || ''}`.toLowerCase();
    return (
      tNum.includes(q) ||
      subj.includes(q) ||
      desc.includes(q) ||
      tag.includes(q) ||
      assetId.includes(q) ||
      assetName.includes(q) ||
      reqName.includes(q)
    );
  });

  const filteredAssets = assets.filter((a) => {
    if (!ticketAssetSearch.trim()) return true;
    const q = ticketAssetSearch.toLowerCase();
    return (
      (a.assetTag && a.assetTag.toLowerCase().includes(q)) ||
      a.assetId.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.serialNumber.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            IT Support Helpdesk & Incident SLA
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track user incidents, hardware malfunctions, ticket assignments, and SLA response timelines
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Raise IT Ticket</span>
        </button>
      </div>

      {/* Filter bar with Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by Asset Tag, ID, Subject, Requester..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <button
            onClick={fetchTickets}
            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            title="Refresh Tickets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Ticket #</th>
                <th className="py-3 px-4">Subject & Description</th>
                <th className="py-3 px-4">Requester</th>
                <th className="py-3 px-4">Linked Asset & Tag</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">SLA Target</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading support tickets...</span>
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    {searchTerm ? `No tickets matching "${searchTerm}"` : 'No support tickets found.'}
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedTicket(t)}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {t.ticketNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                        {t.subject}
                      </span>
                      <span className="text-[11px] text-slate-400 line-clamp-1">
                        {t.description}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {t.requester?.firstName} {t.requester?.lastName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {t.requester?.employeeId}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {t.asset ? (
                        <div>
                          <div className="flex items-center space-x-1.5 mb-0.5">
                            <span className="font-bold text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                              {t.asset.assetTag || t.asset.assetId}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTrackTag(t.asset?.assetTag || t.asset?.assetId || '');
                                setTrackerOpen(true);
                              }}
                              title="Track this asset"
                              className="p-1 text-slate-400 hover:text-blue-600 rounded"
                            >
                              <Search className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-[11px] text-slate-500 font-sans block truncate max-w-[130px]">
                            {t.asset.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">General Issue</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={t.priority} type="priority" />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {t.slaDueDate ? new Date(t.slaDueDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded">
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Ticket Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Raise IT Support Ticket"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject *
              </label>
              <input
                type="text"
                required
                value={ticketForm.subject}
                onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                placeholder="Brief summary of the technical issue..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={ticketForm.category}
                  onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="HARDWARE">Hardware / Peripheral</option>
                  <option value="SOFTWARE">Software / OS / License</option>
                  <option value="NETWORK">Network / VPN / Wi-Fi</option>
                  <option value="ACCESS">Access / Credentials</option>
                  <option value="OTHER">Other Request</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="LOW">Low (72 hr SLA)</option>
                  <option value="MEDIUM">Medium (48 hr SLA)</option>
                  <option value="HIGH">High (24 hr SLA)</option>
                  <option value="CRITICAL">Critical (4 hr SLA)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Requester Employee *
                </label>
                <select
                  required
                  value={ticketForm.requesterId}
                  onChange={(e) => setTicketForm({ ...ticketForm, requesterId: e.target.value })}
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
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Associated Asset (Optional)
                  </label>
                  {ticketAssetSearch && (
                    <button
                      type="button"
                      onClick={() => setTicketAssetSearch('')}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={ticketAssetSearch}
                    onChange={(e) => setTicketAssetSearch(e.target.value)}
                    placeholder="Search by tag, ID, or name..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <select
                    value={ticketForm.assetId}
                    onChange={(e) => setTicketForm({ ...ticketForm, assetId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">-- No specific asset --</option>
                    {assets
                      .filter((a) => {
                        if (!ticketAssetSearch) return true;
                        const q = ticketAssetSearch.toLowerCase();
                        return (
                          (a.assetTag && a.assetTag.toLowerCase().includes(q)) ||
                          (a.assetId && a.assetId.toLowerCase().includes(q)) ||
                          (a.name && a.name.toLowerCase().includes(q)) ||
                          (a.serialNumber && a.serialNumber.toLowerCase().includes(q))
                        );
                      })
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.assetTag || a.assetId}] {a.name} ({a.serialNumber})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Detailed Issue Description *
              </label>
              <textarea
                required
                rows={4}
                value={ticketForm.description}
                onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                placeholder="Include error codes, symptoms, and troubleshooting performed..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            {/* Custom Specifications for Tickets */}
            <div className="pt-2">
              <CustomFieldRenderer
                entity="TICKET"
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
              Submit Ticket
            </button>
          </div>
        </form>
      </Modal>

      {/* Ticket Details & Comments Modal */}
      {selectedTicket && (
        <Modal
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          title={`Ticket Details - ${selectedTicket.ticketNumber}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {selectedTicket.subject}
                </h3>
                <span className="text-xs text-slate-500">
                  Raised by {selectedTicket.requester?.firstName} {selectedTicket.requester?.lastName} on{' '}
                  {new Date(selectedTicket.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <StatusBadge status={selectedTicket.priority} type="priority" />
                <StatusBadge status={selectedTicket.status} />
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold block text-slate-900 dark:text-slate-100 mb-1">
                Description:
              </span>
              {selectedTicket.description}
            </div>

            {/* Linked Asset Info */}
            {selectedTicket.asset && (
              <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 rounded-xl text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Laptop className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedTicket.asset.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Tag: <span className="font-bold text-blue-600">{selectedTicket.asset.assetTag || selectedTicket.asset.assetId}</span> • S/N: {selectedTicket.asset.serialNumber || 'N/A'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTrackTag(selectedTicket.asset?.assetTag || selectedTicket.asset?.assetId || '');
                    setTrackerOpen(true);
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-50 shadow-sm"
                >
                  Track Asset
                </button>
              </div>
            )}

            {/* Custom Specifications */}
            <div className="pt-1">
              <CustomFieldDisplay
                customFields={selectedTicket.customFields}
                entity="TICKET"
                title="Ticket Custom Specifications"
              />
            </div>

            {/* Quick Status Changers */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-semibold text-slate-500">Change Status:</span>
              {['IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
                <button
                  key={st}
                  onClick={() => handleUpdateStatus(st)}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 rounded text-[11px] font-semibold"
                >
                  Mark {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Comments Thread */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Conversation & Updates ({(selectedTicket.comments || []).length}):</span>
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(selectedTicket.comments || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No notes posted yet.</p>
                ) : (
                  (selectedTicket.comments || []).map((c: any) => (
                    <div
                      key={c.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                        <span>{c.authorName}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px]">{c.comment}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Input */}
              <form onSubmit={handleAddComment} className="flex items-center space-x-2 pt-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Post response or internal troubleshooting note..."
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  Post
                </button>
              </form>
            </div>
          </div>
        </Modal>
      )}

      {/* Asset Tracker Modal */}
      <AssetTrackerModal
        isOpen={trackerOpen}
        onClose={() => setTrackerOpen(false)}
        initialQuery={trackTag}
      />
    </div>
  );
};
