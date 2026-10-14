import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Link } from 'react-router-dom';
import {
  Laptop,
  CheckCircle2,
  Users,
  Wrench,
  AlertTriangle,
  LifeBuoy,
  ShieldAlert,
  PackageCheck,
  TrendingUp,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { useBranding } from '../customization/BrandingContext.js';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export const DashboardPage: React.FC = () => {
  const { branding } = useBranding();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/assets/dashboard-metrics');
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-500 space-x-2">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-sm font-medium">Loading enterprise ITAM dashboard...</span>
      </div>
    );
  }

  const summary = data?.summary || {};

  const kpis = [
    {
      label: 'Total IT Assets',
      value: summary.totalAssets || 0,
      icon: Laptop,
      color: 'bg-blue-500 text-white',
      link: '/assets',
    },
    {
      label: 'Assigned / In Use',
      value: summary.assignedAssets || 0,
      icon: Users,
      color: 'bg-emerald-500 text-white',
      link: '/assets?status=ASSIGNED',
    },
    {
      label: 'Available in Stock',
      value: summary.availableAssets || 0,
      icon: CheckCircle2,
      color: 'bg-cyan-500 text-white',
      link: '/assets?status=AVAILABLE',
    },
    {
      label: 'Under Maintenance',
      value: summary.maintenanceAssets || 0,
      icon: Wrench,
      color: 'bg-amber-500 text-white',
      link: '/maintenance',
    },
    {
      label: 'Expiring Warranties (90d)',
      value: summary.expiringWarrantyCount || 0,
      icon: AlertTriangle,
      color: 'bg-orange-500 text-white',
      link: '/reports',
    },
    {
      label: 'Open Support Tickets',
      value: summary.openTicketsCount || 0,
      icon: LifeBuoy,
      color: 'bg-indigo-500 text-white',
      link: '/tickets',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Executive IT Asset Dashboard
            </h1>
            {branding.companyName && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {branding.companyName}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time infrastructure inventory health, custody allocations, and service SLA overview {branding.companyName ? `• ${branding.companyName}` : ''}
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={idx}
              to={kpi.link}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </span>
                <div className={`p-2 rounded-lg ${kpi.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {kpi.value}
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets by Category */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Hardware Distribution by Category
            </h3>
            <span className="text-xs text-slate-400 font-medium">Current Active Fleet</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.categoryBreakdown || []}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                >
                  {(data?.categoryBreakdown || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Assets by Department */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Asset Allocation by Department
            </h3>
            <span className="text-xs text-slate-400 font-medium">Headcount & Inventory Ratio</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.departmentBreakdown || []} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Allocated Assets" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Two Column Bottom Grid: Low Stock Consumables & Recent Allocations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low-Stock Spare Parts Alert Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <PackageCheck className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Consumable Stock Levels & Alerts
              </h3>
            </div>
            <Link to="/consumables" className="text-xs font-semibold text-blue-600 hover:underline">
              View All Spares →
            </Link>
          </div>

          <div className="space-y-3">
            {(data?.lowStockConsumables || []).length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                All spare parts and consumables meet minimum threshold limits.
              </p>
            ) : (
              (data?.lowStockConsumables || []).map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-lg text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      {item.name}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Code: {item.itemCode} • Category: {item.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950">
                      {item.stockQuantity} remaining
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      Min threshold: {item.minQuantity}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Allocations Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Recent Custody Allocations
              </h3>
            </div>
            <Link to="/allocations" className="text-xs font-semibold text-blue-600 hover:underline">
              View Handover History →
            </Link>
          </div>

          <div className="space-y-3">
            {(data?.recentAllocations || []).length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No recent allocations.</p>
            ) : (
              (data?.recentAllocations || []).map((alloc: any) => (
                <div
                  key={alloc.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-lg text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {alloc.asset?.name}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        {alloc.asset?.assetTag || alloc.asset?.assetId}
                      </span>
                    </div>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      Recipient: {alloc.employee?.firstName} {alloc.employee?.lastName}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">
                      {new Date(alloc.allocationDate).toLocaleDateString()}
                    </span>
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                        alloc.termsAccepted
                          ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950'
                          : 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950'
                      }`}
                    >
                      {alloc.termsAccepted ? 'Acknowledged' : 'Pending Sign'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
