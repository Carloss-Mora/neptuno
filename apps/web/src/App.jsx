import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { CropProvider } from '@/contexts/CropContext';
import { UserSettingsProvider } from '@/contexts/UserSettingsContext';
import { AlertProvider } from '@/contexts/AlertContext.jsx';
import { Toaster } from '@/components/ui/toaster';
import ScrollToTop from '@/components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';

const LegalPage = lazy(() => import('@/pages/LegalPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ControlPanelPage = lazy(() => import('@/pages/ControlPanelPage'));
const StatisticsPage = lazy(() => import('@/pages/StatisticsPage'));
const IrrigationHistoryPage = lazy(() => import('@/pages/IrrigationHistoryPage.jsx'));
const CropsPage = lazy(() => import('@/pages/CropsPage'));
const DevicesPage = lazy(() => import('@/pages/DevicesPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const SimulatorPage = lazy(() => import('@/pages/SimulatorPage'));
const SensorsPage = lazy(() => import('@/pages/SensorsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));

function App() {
  return (
    <AuthProvider>
      <UserSettingsProvider>
      <CropProvider>
        <AlertProvider>
          <Router>
            <ScrollToTop />
            <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary">Saltar al contenido</a>
            <Suspense fallback={<div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center bg-dew text-slate-600">Cargando…</div>}>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/terminos" element={<LegalPage kind="terms" />} />
            <Route path="/privacidad" element={<LegalPage kind="privacy" />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/control"
              element={
                <ProtectedRoute>
                  <ControlPanelPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/simulator"
              element={
                <ProtectedRoute>
                  <SimulatorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/statistics"
              element={
                <ProtectedRoute>
                  <StatisticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/historial"
              element={
                <ProtectedRoute>
                  <IrrigationHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/crops"
              element={
                <ProtectedRoute>
                  <CropsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/devices"
              element={
                <ProtectedRoute>
                  <DevicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/summary" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/sensors"
              element={
                <ProtectedRoute>
                  <SensorsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            </Routes>
            </Suspense>
            <Toaster />
          </Router>
        </AlertProvider>
      </CropProvider>
      </UserSettingsProvider>
    </AuthProvider>
  );
}

export default App;
