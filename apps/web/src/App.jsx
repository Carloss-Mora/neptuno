
import React from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { CropProvider } from '@/contexts/CropContext';
import { AlertProvider } from '@/contexts/AlertContext.jsx';
import { Toaster } from '@/components/ui/toaster';
import ScrollToTop from '@/components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import DashboardPage from '@/pages/DashboardPage';
import ControlPanelPage from '@/pages/ControlPanelPage';
import StatisticsPage from '@/pages/StatisticsPage';
import IrrigationHistoryPage from '@/pages/IrrigationHistoryPage.jsx';
import CropsPage from '@/pages/CropsPage';
import DevicesPage from '@/pages/DevicesPage';

function App() {
  return (
    <AuthProvider>
      <CropProvider>
        <AlertProvider>
          <Router>
            <ScrollToTop />
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
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
            </Routes>
            <Toaster />
          </Router>
        </AlertProvider>
      </CropProvider>
    </AuthProvider>
  );
}

export default App;
