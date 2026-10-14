import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { BrandingProvider } from './customization/BrandingContext.js';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { AssetsPage } from './pages/AssetsPage.js';
import { AssetDetailPage } from './pages/AssetDetailPage.js';
import { AllocationPage } from './pages/AllocationPage.js';
import { TicketsPage } from './pages/TicketsPage.js';
import { MaintenancePage } from './pages/MaintenancePage.js';
import { LicensesPage } from './pages/LicensesPage.js';
import { ConsumablesPage } from './pages/ConsumablesPage.js';
import { EmployeesPage } from './pages/EmployeesPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { EmployeePortalPage } from './pages/EmployeePortalPage.js';
import { CustomizationCenterPage } from './customization/CustomizationCenterPage.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({
  children,
  roles,
}) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-xs">
        Verifying security credentials...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !hasRole(...roles)) {
    return <Navigate to="/portal/my-assets" replace />;
  }

  return <>{children}</>;
};

const HomeRouter: React.FC = () => {
  const { user } = useAuth();
  if (user?.role?.name === 'EMPLOYEE') {
    return <Navigate to="/portal/my-assets" replace />;
  }
  return <DashboardPage />;
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
              <Route path="portal/my-assets" element={<EmployeePortalPage />} />
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
