import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { BarChart3, Download, Printer, RefreshCw, FileSpreadsheet, ShieldAlert, Wrench, KeyRound, PackageCheck } from 'lucide-react';
import { useBranding } from '../customization/BrandingContext.js';

export const ReportsPage: React.FC = () => {
  const { formatCurrency } = useBranding();
  const [activeReport, setActiveReport] = useState<'inventory' | 'warranty' | 'allocations' | 'maintenance' | 'licenses' | 'consumables' | 'disposals'>('inventory');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/${activeReport}`);
      setReportData(res.data.data || []);
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeReport]);

  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExporting(format);
    try {
      const res = await api.get(`/reports/export?entity=${activeReport}&format=${format}`, {
        responseType: 'blob',
      });
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8;';
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeReport}-audit-report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
      // Fallback with query token if direct blob download encounters issue
      const token = localStorage.getItem('token');
      if (token) {
        window.open(`/api/v1/reports/export?entity=${activeReport}&format=${format}&token=${encodeURIComponent(token)}`, '_blank');
      } else {
        alert('Failed to export report. Please verify login.');
      }
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Enterprise Audit & Compliance Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate and export comprehensive audits across hardware, software licenses, warranties, maintenance, and asset custody
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting !== null}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting === 'xlsx' ? 'Exporting...' : 'Export Excel'}</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-sm hover:bg-slate-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting === 'csv' ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'inventory', label: 'Full Asset Inventory' },
          { id: 'warranty', label: 'Warranties Expiring Soon' },
          { id: 'allocations', label: 'Custody Allocations' },
          { id: 'maintenance', label: 'Maintenance & Service' },
          { id: 'licenses', label: 'SAM Software Licenses' },
          { id: 'consumables', label: 'Consumables & Spares' },
          { id: 'disposals', label: 'Retired & Disposed Assets' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeReport === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Results Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            {activeReport.replace(/_/g, ' ')} Audit Report ({reportData.length} records)
          </h3>
          <button
            onClick={fetchReport}
            className="p-1.5 text-slate-500 hover:text-blue-600 rounded"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Identifier / Ref</th>
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Category / Dept</th>
                <th className="py-3 px-4">Status / Custody</th>
                <th className="py-3 px-4">Value / Cost</th>
                <th className="py-3 px-4">Key Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Compiling audit report...</span>
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No matching records found for this audit category.
                  </td>
                </tr>
              ) : (
                reportData.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {row.assetId || row.itemCode || row.ticketNumber || `REC-${idx + 1}`}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {row.name || row.softwareName || row.subject || row.asset?.name || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {row.category?.name || row.category || row.department?.name || 'Standard'}
                    </td>
                    <td className="py-3 px-4">
                      {row.currentEmployee ? (
                        <span>
                          {row.currentEmployee.firstName} {row.currentEmployee.lastName}
                        </span>
                      ) : row.status ? (
                        <StatusBadge status={row.status} />
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {formatCurrency(row.purchaseCost ?? row.cost ?? row.unitCost)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {row.warrantyEnd
                        ? new Date(row.warrantyEnd).toLocaleDateString()
                        : row.purchaseDate
                        ? new Date(row.purchaseDate).toLocaleDateString()
                        : row.allocationDate
                        ? new Date(row.allocationDate).toLocaleDateString()
                        : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
