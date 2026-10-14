import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Consumable, Employee } from '../types/index.js';
import { Modal } from '../components/Modal.js';
import { PackageCheck, Plus, RefreshCw, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useBranding } from '../customization/BrandingContext.js';

export const ConsumablesPage: React.FC = () => {
  const { branding, formatCurrency } = useBranding();
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [selectedConsumable, setSelectedConsumable] = useState<Consumable | null>(null);

  // Forms state
  const [createForm, setCreateForm] = useState({
    name: '',
    category: 'RAM',
    itemCode: '',
    stockQuantity: 10,
    minQuantity: 5,
    unitCost: '',
  });

  const [txForm, setTxForm] = useState({
    type: 'OUTWARD_ISSUE',
    quantity: 1,
    employeeId: '',
    notes: '',
  });

  const fetchConsumables = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (categoryFilter) params.category = categoryFilter;
      if (lowStockOnly) params.lowStockOnly = 'true';

      const res = await api.get('/consumables', { params });
      setConsumables(res.data.data.consumables || []);
    } catch (err) {
      console.error('Failed to load consumables:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees?limit=100');
      setEmployees(res.data.data);
      if (res.data.data.length > 0) {
        setTxForm((prev) => ({ ...prev, employeeId: res.data.data[0].id }));
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchConsumables();
  }, [categoryFilter, lowStockOnly]);

  const handleCreateConsumable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/consumables', {
        ...createForm,
        unitCost: createForm.unitCost ? parseFloat(createForm.unitCost) : 0,
      });
      setCreateModalOpen(false);
      fetchConsumables();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create consumable');
    }
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsumable) return;

    try {
      await api.post(`/consumables/${selectedConsumable.id}/transaction`, txForm);
      setTxModalOpen(false);
      fetchConsumables();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Transaction failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Spare Parts & Consumables Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain stock quotas, spare memory, NVMe SSDs, cables, toners, and hardware issue history
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Spare Item</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
        >
          <option value="">All Categories</option>
          <option value="RAM">RAM / Memory</option>
          <option value="SSD">SSD / NVMe</option>
          <option value="CHARGER">Chargers / Adapters</option>
          <option value="CABLE">Cables / Patch Leads</option>
          <option value="TONER">Toner / Cartridges</option>
          <option value="KEYBOARD">Keyboards & Mice</option>
        </select>

        <label className="flex items-center space-x-2 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
          />
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            Show Low Stock Alerts Only
          </span>
        </label>

        <button
          onClick={fetchConsumables}
          className="p-2 ml-auto bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200"
          title="Refresh List"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Consumables Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Item Code</th>
                <th className="py-3 px-4">Consumable Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Current Stock</th>
                <th className="py-3 px-4">Min Threshold</th>
                <th className="py-3 px-4">Unit Cost ({branding.currencySymbol || '$'})</th>
                <th className="py-3 px-4">Health Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading spare inventory...</span>
                  </td>
                </tr>
              ) : consumables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No consumables found.
                  </td>
                </tr>
              ) : (
                consumables.map((item) => {
                  const isLow = item.stockQuantity <= item.minQuantity;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {item.itemCode}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {item.category}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-sm text-slate-900 dark:text-slate-100">
                        {item.stockQuantity} units
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{item.minQuantity} units</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(item.unitCost)}
                      </td>
                      <td className="py-3.5 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                            Low Stock Alert
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Adequate Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedConsumable(item);
                            setTxModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded shadow-sm"
                        >
                          Issue / Restock
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Consumable Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register Spare Part / Consumable"
        maxWidth="md"
      >
        <form onSubmit={handleCreateConsumable} className="space-y-4">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Item Name *
              </label>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Crucial 32GB DDR5 SODIMM"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Item Code *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.itemCode}
                  onChange={(e) => setCreateForm({ ...createForm, itemCode: e.target.value })}
                  placeholder="CSM-RAM-32G"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="RAM">RAM / Memory</option>
                  <option value="SSD">SSD / NVMe</option>
                  <option value="CHARGER">Charger / Adapter</option>
                  <option value="CABLE">Cable / Patch Lead</option>
                  <option value="TONER">Toner / Ink Cartridge</option>
                  <option value="KEYBOARD">Keyboard / Mouse</option>
                  <option value="BATTERY">Battery</option>
                  <option value="OTHER">Other Consumable</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Stock
                </label>
                <input
                  type="number"
                  min={0}
                  value={createForm.stockQuantity}
                  onChange={(e) => setCreateForm({ ...createForm, stockQuantity: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Min Alert Limit
                </label>
                <input
                  type="number"
                  min={1}
                  value={createForm.minQuantity}
                  onChange={(e) => setCreateForm({ ...createForm, minQuantity: parseInt(e.target.value, 10) || 5 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Unit Cost ({branding.currencySymbol || '$'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={createForm.unitCost}
                  onChange={(e) => setCreateForm({ ...createForm, unitCost: e.target.value })}
                  placeholder="89.99"
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
              Save Spare Part
            </button>
          </div>
        </form>
      </Modal>

      {/* Issue / Restock Transaction Modal */}
      {selectedConsumable && (
        <Modal
          isOpen={txModalOpen}
          onClose={() => setTxModalOpen(false)}
          title={`Inventory Transaction: ${selectedConsumable.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleTxSubmit} className="space-y-4">
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-slate-500">Current In-Stock Quantity:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {selectedConsumable.stockQuantity} units
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={txForm.type}
                    onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="OUTWARD_ISSUE">Issue Outward (Dispatch to User)</option>
                    <option value="INWARD">Restock Inward (New Supply)</option>
                    <option value="RETURN">Return to Inventory</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={txForm.quantity}
                    onChange={(e) => setTxForm({ ...txForm, quantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {txForm.type === 'OUTWARD_ISSUE' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Recipient Employee
                  </label>
                  <select
                    value={txForm.employeeId}
                    onChange={(e) => setTxForm({ ...txForm, employeeId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeId})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  value={txForm.notes}
                  onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                  placeholder="e.g. Laptop RAM upgrade for engineer"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTxModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Record Transaction
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
