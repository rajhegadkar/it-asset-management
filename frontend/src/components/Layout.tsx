import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { BarcodeScannerModal } from './BarcodeScannerModal.js';
import { AssetTrackerModal } from './AssetTrackerModal.js';
import { StatusBadge } from './StatusBadge.js';
import { api } from '../api/client.js';
import { NotificationItem, Asset } from '../types/index.js';
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
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { useBranding } from '../customization/BrandingContext.js';

export const Layout: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { branding } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [trackerModalOpen, setTrackerModalOpen] = useState(false);
  const [selectedTrackTag, setSelectedTrackTag] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Global Header Search / Asset Tracker state
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Asset[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener ('/' to focus search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || (e.ctrlKey && e.key === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick search debounce
  useEffect(() => {
    const q = globalSearch.trim();
    if (!q) {
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
      } catch (e) {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [globalSearch]);

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = globalSearch.trim();
    if (!q) return;

    if (searchResults.length > 0) {
      navigate(`/assets/${searchResults[0].id}`);
      setSearchOpen(false);
      setGlobalSearch('');
    } else {
      setSelectedTrackTag(q);
      setTrackerModalOpen(true);
      setSearchOpen(false);
    }
  };

  // Fetch in-app notifications
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
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.put('/system/notifications/read-all');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {}
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'] },
    { label: 'IT Assets', icon: Laptop, path: '/assets', roles: ['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'] },
    { label: 'Allocations & Custody', icon: ArrowRightLeft, path: '/allocations', roles: ['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'] },
    { label: 'Helpdesk Tickets', icon: LifeBuoy, path: '/tickets', roles: ['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'] },
    { label: 'Maintenance & Repairs', icon: Wrench, path: '/maintenance', roles: ['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'] },
    { label: 'Software Licenses (SAM)', icon: KeyRound, path: '/licenses', roles: ['SUPER_ADMIN', 'IT_ADMIN'] },
    { label: 'Spare Parts & Consumables', icon: PackageCheck, path: '/consumables', roles: ['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'] },
    { label: 'Employees Directory', icon: Users, path: '/employees', roles: ['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'] },
    { label: 'Reports & Analytics', icon: BarChart3, path: '/reports', roles: ['SUPER_ADMIN', 'IT_ADMIN'] },
    { label: 'Settings & Mail', icon: Settings, path: '/settings', roles: ['SUPER_ADMIN'] },
    { label: 'Customization Center', icon: Sliders, path: '/customization', roles: ['SUPER_ADMIN'] },
    { label: 'My Assigned Assets', icon: UserCheck, path: '/portal/my-assets', roles: ['EMPLOYEE', 'SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'] },
  ];

  const visibleNav = navItems.filter((item) => hasRole(...item.roles));

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950/40">
          <Link to="/" className="flex items-center space-x-3 overflow-hidden">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white/10 p-0.5 shadow-md shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20 shrink-0">
                <Laptop className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <span className="font-bold tracking-tight text-white block text-sm leading-tight truncate">
                {branding.companyName || branding.portalTitle || 'IT Asset Manager'}
              </span>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] text-blue-400 font-mono tracking-wider font-semibold">
                  v2.0 ENTERPRISE
                </span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1 py-0.5 rounded font-bold font-mono">
                  LOCAL
                </span>
              </div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Current User Info in Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/30 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <span className="inline-block px-1.5 py-0.5 bg-blue-950 text-blue-400 border border-blue-800/60 rounded text-[10px] font-mono uppercase">
                {user?.role.displayName || user?.role.name}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 z-20 gap-4">
          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block text-xs text-slate-500 font-medium truncate max-w-[240px]" title={branding.companyName || user?.organization?.name || ''}>
              {branding.companyName || user?.organization?.name || 'IT Asset Management'}
            </div>
          </div>

          {/* Prominent Global Asset Tag Search & Quick Tracker */}
          <div ref={searchRef} className="flex-1 max-w-xl relative">
            <form onSubmit={handleGlobalSearchSubmit} className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={globalSearch}
                  onFocus={() => {
                    if (searchResults.length > 0) setSearchOpen(true);
                  }}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Track asset by Tag (e.g. IT-LAP-000001), Serial, or Name... (Press '/' to search)"
                  className="w-full pl-10 pr-24 py-1.5 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute right-2 flex items-center space-x-1">
                  {globalSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setGlobalSearch('');
                        setSearchResults([]);
                        setSearchOpen(false);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-200 dark:bg-slate-700 rounded">
                    /
                  </span>
                </div>
              </div>
            </form>

            {/* Live Asset Dropdown Search Results */}
            {searchOpen && (
              <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden max-h-96 overflow-y-auto">
                <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                  <span>
                    {searchLoading
                      ? 'Searching inventory...'
                      : `${searchResults.length} matching asset(s)`}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedTrackTag(globalSearch);
                      setTrackerModalOpen(true);
                      setSearchOpen(false);
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
                  >
                    <Tag className="w-3 h-3" />
                    <span>Open Tracker Modal</span>
                  </button>
                </div>

                {searchResults.length === 0 && !searchLoading ? (
                  <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                    <p>No asset found matching "{globalSearch}".</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTrackTag(globalSearch);
                        setTrackerModalOpen(true);
                        setSearchOpen(false);
                      }}
                      className="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-lg text-xs font-semibold"
                    >
                      Search & Track by Custom Tag / ID
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {searchResults.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => {
                          navigate(`/assets/${a.id}`);
                          setSearchOpen(false);
                          setGlobalSearch('');
                        }}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Tag className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                                {a.assetTag || a.assetId}
                              </span>
                              <StatusBadge status={a.status} />
                            </div>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                              {a.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              S/N: {a.serialNumber} • {a.category?.name || 'General'}
                              {a.currentEmployee && (
                                <span className="text-slate-600 dark:text-slate-300 font-medium">
                                  {' '}
                                  • Custodian: {a.currentEmployee.firstName}{' '}
                                  {a.currentEmployee.lastName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
            {/* Quick Asset Tracker Modal Button */}
            <button
              onClick={() => {
                setSelectedTrackTag('');
                setTrackerModalOpen(true);
              }}
              className="h-8 flex items-center space-x-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              title="Track Asset by Tag"
            >
              <Tag className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Track Asset</span>
            </button>

            {/* Quick Barcode Scanner Trigger Button */}
            <button
              onClick={() => setScannerOpen(true)}
              className="h-8 flex items-center space-x-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
              title="Scan Barcode / QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Scanner</span>
            </button>

            {/* Dark / Light Toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
              title="Toggle Dark Mode"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Notifications ({unreadCount} unread)
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-blue-600 hover:underline font-semibold"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-lg text-xs ${
                            n.isRead
                              ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border border-blue-200 dark:border-blue-900'
                          }`}
                        >
                          <div className="font-semibold">{n.title}</div>
                          <div className="text-[11px] mt-0.5">{n.message}</div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Global Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />

      {/* Global Asset Tracker Modal */}
      <AssetTrackerModal
        isOpen={trackerModalOpen}
        onClose={() => setTrackerModalOpen(false)}
        initialQuery={selectedTrackTag}
      />
    </div>
  );
};
