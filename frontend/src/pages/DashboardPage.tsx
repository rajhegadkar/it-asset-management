import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { useBranding } from '../customization/BrandingContext.js';
import {
  Laptop,
  CheckCircle2,
  Users,
  Wrench,
  AlertTriangle,
  LifeBuoy,
  PackageCheck,
  ArrowUpRight,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  ShieldAlert,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

// Categorical palette (validated for colour-vision deficiency; fixed order, never cycled).
// Light / dark steps from the dataviz reference palette.
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
const MAX_SLICES = 7; // 8th slot becomes "Other" so no colour is ever generated or reused

type Kpi = { label: string; value: number; icon: React.ElementType; tint: string; link: string; hint?: string };

const Tile: React.FC<{ k: Kpi }> = ({ k }) => {
  const Icon = k.icon;
  return (
    <Link
      to={k.link}
      className="card card-hover group p-4 sm:p-5 flex flex-col justify-between min-h-[118px]"
      data-testid={`kpi-${k.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.tint}`}>
          <Icon className="w-5 h-5" />
        </span>
        <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
      </div>
      <div className="mt-3">
        <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular">{k.value.toLocaleString()}</p>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{k.label}</p>
      </div>
    </Link>
  );
};

const SectionCard: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  subtitle,
  action,
  children,
  className = '',
}) => (
  <section className={`card p-5 sm:p-6 ${className}`}>
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const DashboardSkeleton = () => (
  <div className="space-y-6" aria-busy="true">
    <div className="skeleton h-24 rounded-2xl" />
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-[118px] rounded-2xl" />
      ))}
    </div>
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="skeleton h-80 rounded-2xl" />
      <div className="skeleton h-80 rounded-2xl" />
    </div>
  </div>
);

export const DashboardPage: React.FC = () => {
  const { branding } = useBranding();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await api.get('/assets/dashboard-metrics');
      setData(res.data.data);
    } catch {
      setError('Could not load dashboard metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const series = theme === 'dark' ? SERIES_DARK : SERIES_LIGHT;

  const categories = useMemo(() => {
    const rows = [...(data?.categoryBreakdown || [])].sort((a: any, b: any) => b.count - a.count);
    if (rows.length <= MAX_SLICES + 1) return rows;
    const head = rows.slice(0, MAX_SLICES);
    const other = rows.slice(MAX_SLICES).reduce((s: number, r: any) => s + r.count, 0);
    return [...head, { name: 'Other', count: other }];
  }, [data]);
  const categoryTotal = categories.reduce((s: number, r: any) => s + r.count, 0);

  const departments = useMemo(
    () => [...(data?.departmentBreakdown || [])].sort((a: any, b: any) => b.count - a.count).slice(0, 8),
    [data]
  );
  const deptMax = Math.max(1, ...departments.map((d: any) => d.count));

  if (loading) return <DashboardSkeleton />;

  const s = data?.summary || {};
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const kpis: Kpi[] = [
    { label: 'Total assets', value: s.totalAssets || 0, icon: Laptop, tint: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300', link: '/assets' },
    { label: 'Assigned / in use', value: s.assignedAssets || 0, icon: Users, tint: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300', link: '/assets?status=ASSIGNED' },
    { label: 'Available in stock', value: s.availableAssets || 0, icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300', link: '/assets?status=AVAILABLE' },
    { label: 'Under maintenance', value: s.maintenanceAssets || 0, icon: Wrench, tint: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300', link: '/maintenance' },
    { label: 'Warranties ending (90 days)', value: s.expiringWarrantyCount || 0, icon: AlertTriangle, tint: 'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300', link: '/reports' },
    { label: 'Open tickets', value: s.openTicketsCount || 0, icon: LifeBuoy, tint: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300', link: '/tickets' },
  ];

  const lowStock = data?.lowStockConsumables || [];
  const attention = [
    s.criticalTicketsCount > 0 && {
      icon: ShieldAlert,
      tone: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300',
      text: `${s.criticalTicketsCount} critical ticket${s.criticalTicketsCount > 1 ? 's' : ''} open`,
      link: '/tickets',
    },
    s.expiringWarrantyCount > 0 && {
      icon: AlertTriangle,
      tone: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300',
      text: `${s.expiringWarrantyCount} warrant${s.expiringWarrantyCount > 1 ? 'ies' : 'y'} ending within 90 days`,
      link: '/reports',
    },
    lowStock.length > 0 && {
      icon: PackageCheck,
      tone: 'text-orange-700 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-300',
      text: `${lowStock.length} spare part${lowStock.length > 1 ? 's' : ''} at or below minimum stock`,
      link: '/consumables',
    },
  ].filter(Boolean) as Array<{ icon: React.ElementType; tone: string; text: string; link: string }>;

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl p-5 sm:p-7 text-white bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 shadow-lg shadow-blue-900/20">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="absolute right-24 -bottom-20 w-48 h-48 rounded-full bg-white/5 blur-xl" aria-hidden />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <p className="text-sm text-blue-100">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              {branding.companyName ? ` · ${branding.companyName}` : ''}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white dark:text-white">
              {greeting}, {user?.firstName || 'there'}
            </h1>
            <p className="mt-1 text-sm text-blue-100/90 max-w-xl">
              {s.totalAssets || 0} assets tracked · {s.assignedAssets || 0} with employees · {s.openTicketsCount || 0} open tickets
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/assets?new=1')} className="btn h-10 bg-white text-blue-700 hover:bg-blue-50 shadow-sm">
              <Plus className="w-4 h-4" /> New asset
            </button>
            <button onClick={() => navigate('/allocations')} className="btn h-10 bg-white/10 text-white hover:bg-white/20 ring-1 ring-inset ring-white/20">
              <ArrowRightLeft className="w-4 h-4" /> Allocate
            </button>
            <button onClick={() => navigate('/tickets')} className="btn h-10 bg-white/10 text-white hover:bg-white/20 ring-1 ring-inset ring-white/20">
              <LifeBuoy className="w-4 h-4" /> Tickets
            </button>
            <button
              onClick={() => fetchMetrics(true)}
              className="icon-btn h-10 w-10 text-white hover:bg-white/15 hover:text-white"
              aria-label="Refresh metrics"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="card p-4 flex items-center justify-between gap-3 border-rose-200 dark:border-rose-900">
          <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button onClick={() => fetchMetrics()} className="btn-secondary h-9">Try again</button>
        </div>
      )}

      {/* Needs attention */}
      {attention.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 sm:flex-wrap" aria-label="Needs attention">
          {attention.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.text} to={a.link} className={`shrink-0 inline-flex items-center gap-2 h-10 px-3.5 rounded-xl text-sm font-medium ${a.tone} hover:brightness-95`}>
                <Icon className="w-4 h-4" />
                {a.text}
                <ChevronRight className="w-4 h-4 opacity-60" />
              </Link>
            );
          })}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <Tile key={k.label} k={k} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <SectionCard title="Assets by category" subtitle="Active fleet, excluding retired and disposed" className="lg:col-span-2">
          {categoryTotal === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No assets yet.</p>
          ) : (
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6">
              <div
                className="relative w-48 h-48 shrink-0"
                role="img"
                aria-label={`Assets by category: ${categories.map((c: any) => `${c.name} ${c.count}`).join(', ')}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="count"
                      nameKey="name"
                      innerRadius="68%"
                      outerRadius="100%"
                      paddingAngle={categories.length > 1 ? 1.5 : 0}
                      stroke={theme === 'dark' ? 'rgb(15 20 33)' : '#ffffff'}
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {categories.map((c: any, i: number) => (
                        <Cell key={i} fill={series[i]} {...({ 'aria-label': `${c.name}: ${c.count}` } as any)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any, n: any) => [`${v} (${Math.round((Number(v) / categoryTotal) * 100)}%)`, n]}
                      contentStyle={{ borderRadius: 12, border: '1px solid rgb(var(--line))', background: 'rgb(var(--surface))', color: 'rgb(var(--ink))', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white tabular">{categoryTotal}</span>
                  <span className="text-xs text-slate-500">assets</span>
                </div>
              </div>
              <ul className="w-full min-w-0 flex-1 space-y-2" aria-label="Category legend">
                {categories.map((c: any, i: number) => (
                  <li key={c.name} className="flex items-center gap-3 text-sm">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: series[i] }} />
                    <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{c.name}</span>
                    <span className="tabular font-semibold text-slate-900 dark:text-white">{c.count}</span>
                    <span className="tabular w-10 text-right text-xs text-slate-500">{Math.round((c.count / categoryTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Assets by department" subtitle="Top departments by number of assets" className="lg:col-span-3">
          {departments.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No assets are linked to a department yet.</p>
          ) : (
            <ul className="space-y-3.5" aria-label="Assets by department">
              {departments.map((d: any) => (
                <li key={d.name} className="group" title={`${d.name}: ${d.count} assets`}>
                  <div className="flex items-baseline justify-between gap-3 text-sm mb-1.5">
                    <span className="truncate text-slate-700 dark:text-slate-200">{d.name}</span>
                    <span className="tabular font-semibold text-slate-900 dark:text-white">{d.count}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 group-hover:bg-blue-600 transition-[width] duration-500"
                      style={{ width: `${Math.max(4, (d.count / deptMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Low stock"
          subtitle="Spare parts at or below their minimum level"
          action={
            <Link to="/consumables" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
              View all
            </Link>
          }
        >
          {lowStock.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
              <p className="mt-2 text-sm text-slate-500">All spare parts are above their minimum stock.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line -my-2">
              {lowStock.map((item: any) => (
                <li key={item.id} className="py-3 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-300 flex items-center justify-center shrink-0">
                    <PackageCheck className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{item.itemCode}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular ${item.stockQuantity === 0 ? 'text-rose-600' : 'text-orange-600'}`}>{item.stockQuantity} left</p>
                    <p className="text-xs text-slate-500 tabular">min {item.minQuantity}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent allocations"
          subtitle="Latest equipment handed to employees"
          action={
            <Link to="/allocations" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
              View all
            </Link>
          }
        >
          {(data?.recentAllocations || []).length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No allocations yet.</p>
          ) : (
            <ul className="divide-y divide-line -my-2">
              {(data?.recentAllocations || []).map((a: any) => (
                <li key={a.id}>
                  <Link to={`/assets/${a.assetId}`} className="py-3 flex items-center gap-3 group">
                    <span className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                      {(a.employee?.firstName?.[0] || '') + (a.employee?.lastName?.[0] || '')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{a.asset?.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {a.employee?.firstName} {a.employee?.lastName} · <span className="font-mono">{a.asset?.assetTag}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(a.allocationDate).toLocaleDateString()}
                      </p>
                      <p className={`text-[11px] font-semibold mt-0.5 ${a.termsAccepted ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {a.termsAccepted ? 'Signed' : 'Awaiting signature'}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
};
