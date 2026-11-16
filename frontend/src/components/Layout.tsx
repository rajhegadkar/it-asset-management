import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { BarcodeScannerModal } from './BarcodeScannerModal.js';
import { AssetTrackerModal } from './AssetTrackerModal.js';
import { StatusBadge } from './StatusBadge.js';
import { DialogHost } from './ui/dialogs.js';
import { LabelOptionsHost } from './ui/labelPrint.js';
import { useResponsiveTables } from './ui/useResponsiveTables.js';
import { api } from '../api/client.js';
import { prefetchPage } from '../routes.js';
import { NotificationItem, Asset } from '../types/index.js';
import { useBranding } from '../customization/BrandingContext.js';
import {
  LayoutDashboard,
  Laptop,
  ArrowRightLeft,
  LifeBuoy,
  Wrench,
  KeyRound,
  PackageCheck,
  Users,
  BarChart3,
  Settings,
  Sliders,
  UserCheck,
  QrCode,
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Search,
  Tag,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  CheckCheck,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

type NavItem = { label: string; short: string; icon: React.ElementType; path: string; roles: string[]; flag?: string };
type NavGroup = { title: string; items: NavItem[] };

const STAFF = ['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'];
const ADMINS = ['SUPER_ADMIN', 'IT_ADMIN'];

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', short: 'Home', icon: LayoutDashboard, path: '/', roles: STAFF }],
  },
  {
    title: 'Operations',
    items: [
      { label: 'IT Assets', short: 'Assets', icon: Laptop, path: '/assets', roles: STAFF },
      { label: 'Allocations & Custody', short: 'Custody', icon: ArrowRightLeft, path: '/allocations', roles: STAFF },
      { label: 'Helpdesk Tickets', short: 'Tickets', icon: LifeBuoy, path: '/tickets', roles: STAFF },
      { label: 'Maintenance & Repairs', short: 'Repairs', icon: Wrench, path: '/maintenance', roles: STAFF, flag: 'enableMaintenance' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Software Licenses', short: 'Licenses', icon: KeyRound, path: '/licenses', roles: ADMINS, flag: 'enableSamLicenses' },
      { label: 'Spare Parts & Consumables', short: 'Spares', icon: PackageCheck, path: '/consumables', roles: STAFF, flag: 'enableConsumables' },
    ],
  },
  {
    title: 'People & Insights',
    items: [
      { label: 'Employees', short: 'People', icon: Users, path: '/employees', roles: STAFF },
      { label: 'Reports & Analytics', short: 'Reports', icon: BarChart3, path: '/reports', roles: ADMINS },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Settings & Mail', short: 'Settings', icon: Settings, path: '/settings', roles: ['SUPER_ADMIN'] },
      { label: 'Customization Center', short: 'Customize', icon: Sliders, path: '/customization', roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    title: 'Self-service',
    items: [{ label: 'My Assigned Assets', short: 'My assets', icon: UserCheck, path: '/portal/my-assets', roles: ['EMPLOYEE', ...STAFF], flag: 'enableEmployeePortal' }],
  },
];

function timeAgo(date: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d ago` : new Date(date).toLocaleDateString();
}

export const Layout: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { branding } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();

  const isStaffUser = hasRole(...STAFF);

  const [featureFlags, setFeatureFlags] = useState<Record<string, any>>({});
  useEffect(() => {
    api
      .get('/customization/features')
      .then((res) => setFeatureFlags(res.data?.data || {}))
      .catch(() => setFeatureFlags({}));
  }, []);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('itam_sidebar_collapsed') === '1');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [trackerModalOpen, setTrackerModalOpen] = useState(false);
  const [selectedTrackTag, setSelectedTrackTag] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Asset[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  // Phone-friendly tables on every page
  useResponsiveTables(location.pathname);

  useEffect(() => {
    localStorage.setItem('itam_sidebar_collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  // Close drawer / popovers when navigating
  useEffect(() => {
    setDrawerOpen(false);
    setNotificationsOpen(false);
    setSearchOpen(false);
    setMobileSearch(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  // Lock page scroll behind the mobile drawer / search
  useEffect(() => {
    document.body.style.overflow = drawerOpen || mobileSearch ? 'hidden' : '';
    if (mobileSearch) setTimeout(() => mobileSearchRef.current?.focus(), 50);
  }, [drawerOpen, mobileSearch]);

  // Keyboard: "/" or Ctrl/Cmd+K focuses search, Esc closes popovers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '');
      if (isStaffUser && ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
        e.preventDefault();
        if (window.innerWidth < 768) setMobileSearch(true);
        else searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setDrawerOpen(false);
        setMobileSearch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStaffUser]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced asset search (staff only)
  useEffect(() => {
    const q = globalSearch.trim();
    if (!q || !isStaffUser) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/assets/quick-search?q=${encodeURIComponent(q)}`);
        setSearchResults(res.data.data || []);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [globalSearch, isStaffUser]);

  const openAsset = (id: string) => {
    navigate(`/assets/${id}`);
    setSearchOpen(false);
    setMobileSearch(false);
    setGlobalSearch('');
  };

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = globalSearch.trim();
    if (!q) return;
    if (searchResults.length > 0) {
      openAsset(searchResults[0].id);
    } else {
      setSelectedTrackTag(q);
      setTrackerModalOpen(true);
      setSearchOpen(false);
      setMobileSearch(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/system/notifications');
      setNotifications(res.data.data.notifications || []);
      setUnreadCount(res.data.data.unreadCount || 0);
    } catch (e) {
      console.debug('Notification polling notice:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.put('/system/notifications/read-all');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      /* ignore */
    }
  };

  const openNotification = async (n: NotificationItem) => {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      api.put(`/system/notifications/${n.id}/read`).catch(() => undefined);
    }
    setNotificationsOpen(false);
    if (n.link) navigate(n.link.startsWith('/') ? n.link : `/${n.link}`);
  };

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) => hasRole(...i.roles) && !(i.flag && featureFlags[i.flag] === false)),
      })).filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, featureFlags]
  );
  const flatItems = groups.flatMap((g) => g.items);

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));
  const current = flatItems.find((i) => isActive(i.path));

  // Prefetch the most-used pages once the browser is idle
  useEffect(() => {
    const idle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => flatItems.slice(0, 5).forEach((i) => prefetchPage(i.path)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length]);

  // Bottom navigation (phones): 4 main destinations + "More"
  const bottomItems = isStaffUser
    ? ['/', '/assets', '/tickets', '/allocations'].map((p) => flatItems.find((i) => i.path === p)).filter(Boolean) as NavItem[]
    : [];

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U';
  const roleLabel = (user?.role.displayName || user?.role.name || '').replace(/_/g, ' ');

  const sidebar = (mobile: boolean) => (
    <div className="on-dark flex h-full flex-col text-slate-300" style={{ backgroundColor: 'rgb(var(--sidebar))' }}>
      {/* Brand */}
      <div className={`flex items-center h-16 shrink-0 border-b border-white/5 ${collapsed && !mobile ? 'justify-center px-2' : 'justify-between px-4'}`}>
        <Link to={isStaffUser ? '/' : '/portal/my-assets'} className="flex items-center gap-3 min-w-0" title={branding.companyName}>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-900/40 shrink-0">
              <Laptop className="w-5 h-5" />
            </div>
          )}
          {(!collapsed || mobile) && (
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-white truncate leading-tight">
                {branding.portalTitle || 'IT Asset Management'}
              </span>
              <span className="block text-[11px] text-slate-400 truncate">{branding.companyName}</span>
            </div>
          )}
        </Link>
        {mobile && (
          <button onClick={() => setDrawerOpen(false)} className="icon-btn text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Main">
        {groups.map((g) => (
          <div key={g.title}>
            {(!collapsed || mobile) && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{g.title}</p>
            )}
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onMouseEnter={() => prefetchPage(item.path)}
                    onFocus={() => prefetchPage(item.path)}
                    title={collapsed && !mobile ? item.label : undefined}
                    data-testid={`nav-${item.path === '/' ? 'dashboard' : item.path.replace(/^\//, '').replace(/\//g, '-')}`}
                    className={`group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors ${
                      collapsed && !mobile ? 'justify-center h-11 w-11 mx-auto' : 'px-3 h-10'
                    } ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-blue-400" />}
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-blue-300' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className={`shrink-0 border-t border-white/5 p-3 ${collapsed && !mobile ? 'flex flex-col items-center gap-2' : ''}`}>
        <div className={`flex items-center gap-3 ${collapsed && !mobile ? 'justify-center' : 'px-1'}`}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/40 to-blue-700/40 ring-1 ring-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0" title={`${user?.firstName} ${user?.lastName}`}>
            {initials}
          </div>
          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[11px] text-slate-400 truncate capitalize">{roleLabel.toLowerCase()}</p>
            </div>
          )}
          {(!collapsed || mobile) && (
            <button onClick={logout} className="icon-btn text-slate-400 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out" data-testid="logout">
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
        {collapsed && !mobile && (
          <button onClick={logout} className="icon-btn text-slate-400 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out">
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        )}
      </div>
    </div>
  );

  const searchResultsList = (
    <>
      {searchLoading && (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Searching…
        </div>
      )}
      {!searchLoading && searchResults.length === 0 && globalSearch.trim() && (
        <div className="px-4 py-6 text-center text-sm text-slate-500">
          <p>No asset matches “{globalSearch}”.</p>
          <button
            onClick={() => {
              setSelectedTrackTag(globalSearch);
              setTrackerModalOpen(true);
              setSearchOpen(false);
              setMobileSearch(false);
            }}
            className="mt-2 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            Open the tracker instead
          </button>
        </div>
      )}
      {!searchLoading &&
        searchResults.map((a) => (
          <button
            key={a.id}
            onClick={() => openAsset(a.id)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-line last:border-0 group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Laptop className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-300">{a.assetTag || a.assetId}</span>
                <StatusBadge status={a.status} />
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{a.name}</p>
              <p className="text-xs text-slate-400 truncate">
                S/N {a.serialNumber}
                {a.currentEmployee ? ` · ${a.currentEmployee.firstName} ${a.currentEmployee.lastName}` : ''}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 shrink-0" />
          </button>
        ))}
    </>
  );

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Desktop sidebar */}
      <aside
        className={`no-print hidden lg:block fixed inset-y-0 left-0 z-40 transition-[width] duration-200 ${collapsed ? 'w-[76px]' : 'w-64'}`}
        data-testid="sidebar"
      >
        {sidebar(false)}
      </aside>

      {/* Mobile / tablet drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-950/60 animate-fade-in" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[300px] shadow-pop animate-drawer-in">
            {sidebar(true)}
          </div>
        </div>
      )}

      <div className={`flex min-h-screen flex-col transition-[padding] duration-200 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        {/* Top bar */}
        <header className="no-print sticky top-0 z-30 h-16 shrink-0 border-b border-line bg-white/80 dark:bg-surface/80 backdrop-blur-xl pt-safe">
          <div className="h-16 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 lg:px-8">
            <button onClick={() => setDrawerOpen(true)} className="icon-btn lg:hidden" aria-label="Open menu" data-testid="open-menu">
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="icon-btn hidden lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>

            {/* Current page (phones) */}
            <div className="md:hidden min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{current?.label || 'Asset details'}</p>
            </div>

            {/* Search (tablet / desktop) */}
            {isStaffUser && (
              <div ref={searchRef} className="hidden md:block relative flex-1 max-w-xl">
                <form onSubmit={handleGlobalSearchSubmit} role="search">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    onFocus={() => globalSearch && setSearchOpen(true)}
                    placeholder="Search assets by tag, serial, name or person…"
                    aria-label="Search assets"
                    data-testid="global-search"
                    className="w-full h-10 pl-10 pr-16 rounded-xl bg-slate-100/80 dark:bg-surface-muted border border-transparent text-sm placeholder:text-slate-400 focus:bg-white dark:focus:bg-surface focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition"
                  />
                  {globalSearch ? (
                    <button type="button" onClick={() => setGlobalSearch('')} className="tap-compact absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700" aria-label="Clear search">
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <kbd className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border border-line bg-white dark:bg-surface px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                      Ctrl K
                    </kbd>
                  )}
                </form>
                {searchOpen && globalSearch.trim() && (
                  <div className="absolute left-0 right-0 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-line bg-white dark:bg-surface shadow-pop animate-pop-in z-50">
                    {searchResultsList}
                  </div>
                )}
              </div>
            )}
            {!isStaffUser && <div className="hidden md:block flex-1" />}

            <div className="flex items-center gap-1 sm:gap-1.5 ml-auto shrink-0">
              {isStaffUser && (
                <button onClick={() => setMobileSearch(true)} className="icon-btn md:hidden" aria-label="Search assets">
                  <Search className="w-5 h-5" />
                </button>
              )}
              {isStaffUser && (
                <button
                  onClick={() => {
                    setSelectedTrackTag('');
                    setTrackerModalOpen(true);
                  }}
                  className="btn-primary h-9 px-3 hidden sm:inline-flex"
                  title="Track an asset by tag"
                  data-testid="track-asset"
                >
                  <Tag className="w-4 h-4" />
                  <span className="hidden xl:inline">Track asset</span>
                </button>
              )}
              <button onClick={() => setScannerOpen(true)} className="icon-btn" title="Scan a barcode or QR code" aria-label="Open scanner" data-testid="open-scanner">
                <QrCode className="w-5 h-5" />
              </button>
              <button onClick={toggleTheme} className="icon-btn" title="Toggle dark mode" aria-label="Toggle dark mode" data-testid="theme-toggle">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setNotificationsOpen((o) => !o)}
                  className="icon-btn relative"
                  aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                  data-testid="notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-surface">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto top-[68px] sm:top-auto sm:right-0 sm:mt-2 sm:w-96 rounded-2xl border border-line bg-white dark:bg-surface shadow-pop z-50 animate-pop-in overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
                        <p className="text-xs text-slate-500">{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</p>
                      </div>
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="btn-ghost h-8 px-2.5 text-xs">
                          <CheckCheck className="w-4 h-4" /> Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto divide-y divide-line">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center text-sm text-slate-500">
                          <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          No notifications yet
                        </div>
                      ) : (
                        notifications.slice(0, 20).map((n) => (
                          <button
                            key={n.id}
                            onClick={() => openNotification(n)}
                            className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${n.isRead ? '' : 'bg-blue-50/60 dark:bg-blue-950/20'}`}
                          >
                            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.isRead ? 'bg-transparent' : 'bg-blue-500'}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{n.title}</span>
                              <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</span>
                              <span className="block text-[11px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page */}
        <main
          id="main"
          className={`flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-4 sm:py-6 lg:py-8 ${bottomItems.length ? 'pb-[calc(var(--bottom-nav-h)+24px)] lg:pb-8' : ''}`}
        >
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom navigation (phones & small tablets, staff) */}
      {bottomItems.length > 0 && (
        <nav
          className="no-print lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-white/90 dark:bg-surface/90 backdrop-blur-xl pb-safe"
          aria-label="Quick navigation"
          data-testid="bottom-nav"
        >
          <div className="grid grid-cols-5 h-16">
            {bottomItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}
                >
                  <Icon className="w-5 h-5" />
                  {item.short}
                </Link>
              );
            })}
            <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-500">
              <MoreHorizontal className="w-5 h-5" />
              More
            </button>
          </div>
        </nav>
      )}

      {/* Full-screen search (phones) */}
      {mobileSearch && (
        <div className="md:hidden fixed inset-0 z-50 bg-white dark:bg-surface flex flex-col animate-fade-in" role="dialog" aria-label="Search assets">
          <form onSubmit={handleGlobalSearchSubmit} className="flex items-center gap-2 h-16 px-3 border-b border-line pt-safe">
            <button type="button" onClick={() => setMobileSearch(false)} className="icon-btn" aria-label="Close search">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <input
              ref={mobileSearchRef}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Tag, serial, name or person…"
              className="flex-1 h-11 bg-transparent outline-none text-base"
              enterKeyHint="search"
            />
            <button type="button" onClick={() => { setMobileSearch(false); setScannerOpen(true); }} className="icon-btn" aria-label="Scan instead">
              <QrCode className="w-5 h-5" />
            </button>
          </form>
          <div className="flex-1 overflow-y-auto">
            {globalSearch.trim() ? searchResultsList : <p className="px-4 py-10 text-center text-sm text-slate-500">Start typing to find an asset, or tap the scanner.</p>}
          </div>
        </div>
      )}

      <BarcodeScannerModal isOpen={scannerOpen} onClose={() => setScannerOpen(false)} />
      <AssetTrackerModal isOpen={trackerModalOpen} onClose={() => setTrackerModalOpen(false)} initialQuery={selectedTrackTag} />
      <DialogHost />
      <LabelOptionsHost />
    </div>
  );
};
