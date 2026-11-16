/**
 * Page loaders shared by the router (React.lazy) and the navigation (prefetch on hover / idle),
 * so moving between pages feels instant after the first visit.
 */
export const pageLoaders = {
  '/': () => import('./pages/DashboardPage.js'),
  '/assets': () => import('./pages/AssetsPage.js'),
  '/assets/:id': () => import('./pages/AssetDetailPage.js'),
  '/allocations': () => import('./pages/AllocationPage.js'),
  '/tickets': () => import('./pages/TicketsPage.js'),
  '/maintenance': () => import('./pages/MaintenancePage.js'),
  '/licenses': () => import('./pages/LicensesPage.js'),
  '/consumables': () => import('./pages/ConsumablesPage.js'),
  '/employees': () => import('./pages/EmployeesPage.js'),
  '/reports': () => import('./pages/ReportsPage.js'),
  '/settings': () => import('./pages/SettingsPage.js'),
  '/customization': () => import('./customization/CustomizationCenterPage.js'),
  '/portal/my-assets': () => import('./pages/EmployeePortalPage.js'),
} as const;

const prefetched = new Set<string>();

export function prefetchPage(path: string) {
  const loader = (pageLoaders as Record<string, () => Promise<unknown>>)[path];
  if (!loader || prefetched.has(path)) return;
  prefetched.add(path);
  loader().catch(() => prefetched.delete(path));
}
