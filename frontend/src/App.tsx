import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { BrandingProvider } from './customization/BrandingContext.js';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/LoginPage.js';

// Pages load on demand (code splitting) so the first screen downloads far less JavaScript
const DashboardPage = lazy(() => import('./pages/DashboardPage.js').then((m) => ({ default: m.DashboardPage })));
const AssetsPage = lazy(() => import('./pages/AssetsPage.js').then((m) => ({ default: m.AssetsPage })));
const AssetDetailPage = lazy(() => import('./pages/AssetDetailPage.js').then((m) => ({ default: m.AssetDetailPage })));
const AllocationPage = lazy(() => import('./pages/AllocationPage.js').then((m) => ({ default: m.AllocationPage })));
const TicketsPage = lazy(() => import('./pages/TicketsPage.js').then((m) => ({ default: m.TicketsPage })));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage.js').then((m) => ({ default: m.MaintenancePage })));
const LicensesPage = lazy(() => import('./pages/LicensesPage.js').then((m) => ({ default: m.LicensesPage })));
const ConsumablesPage = lazy(() => import('./pages/ConsumablesPage.js').then((m) => ({ default: m.ConsumablesPage })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage.js').then((m) => ({ default: m.EmployeesPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage.js').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage.js').then((m) => ({ default: m.SettingsPage })));
const EmployeePortalPage = lazy(() => import('./pages/EmployeePortalPage.js').then((m) => ({ default: m.EmployeePortalPage })));
const CustomizationCenterPage = lazy(() => import('./customization/CustomizationCenterPage.js').then((m) => ({ default: m.CustomizationCenterPage })));

// Skeleton shown while a page's code downloads (first visit only; later visits are prefetched)
const PageLoader: React.FC = () => (
  <div className="space-y-6 animate-fade-in" aria-busy="true" aria-label="Loading page">
    <div className="space-y-2">
      <div className="skeleton h-7 w-56" />
      <div className="skeleton h-4 w-80 max-w-full" />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-24 rounded-2xl" />
      ))}
    </div>
    <div className="skeleton h-72 rounded-2xl" />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({
  children,
  roles,
}) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas text-xs">
        <span className="inline-flex items-center gap-2 text-slate-400"><span className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-blue-400 animate-spin" />Loading your workspace…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !hasRole(...roles)) {
    return <Navigate to="/portal/my-assets" replace />;
  }

  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
};

const HomeRouter: React.FC = () => {
  const { user } = useAuth();
  if (user?.role?.name === 'EMPLOYEE') {
    return <Navigate to="/portal/my-assets" replace />;
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <DashboardPage />
    </Suspense>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrandingProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomeRouter />} />
              <Route
                path="assets"
                element={
                  <ProtectedRoute roles={['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER']}>
                    <AssetsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="assets/:id"
                element={
                  <ProtectedRoute roles={['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER']}>
                    <AssetDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="allocations"
                element={
                  <ProtectedRoute roles={['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER']}>
                    <AllocationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="tickets"
                element={
                  <ProtectedRoute roles={['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER']}>
                    <TicketsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="maintenance"
                element={
                  <ProtectedRoute roles={['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER']}>
                    <MaintenancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="licenses"
                element={
                  <ProtectedRoute roles={['SUPER_ADMIN', 'IT_ADMIN']}>
                    <LicensesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="consumables"
                element={
                  <ProtectedRoute roles={['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER']}>
                    <ConsumablesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="employees"
                element={
                  <ProtectedRoute roles={['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER']}>
                    <EmployeesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <ProtectedRoute roles={['SUPER_ADMIN', 'IT_ADMIN']}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute roles={['SUPER_ADMIN']}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="customization"
                element={
                  <ProtectedRoute roles={['SUPER_ADMIN']}>
                    <CustomizationCenterPage />
                  </ProtectedRoute>
                }
              />
              <Route path="portal/my-assets" element={<Suspense fallback={<PageLoader />}><EmployeePortalPage /></Suspense>} />
            </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </BrandingProvider>
    </AuthProvider>
  </ThemeProvider>
);
};
