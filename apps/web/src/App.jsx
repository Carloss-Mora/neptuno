
import React from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { AlertProvider } from '@/contexts/AlertContext.jsx';
import { Toaster } from '@/components/ui/toaster';
import ScrollToTop from '@/components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import DashboardPage from '@/pages/DashboardPage';
import ControlPanelPage from '@/pages/ControlPanelPage';
import StatisticsPage from '@/pages/StatisticsPage';
import IrrigationHistoryPage from '@/pages/IrrigationHistoryPage.jsx';

function App() {
  return (
    <AuthProvider>
      <AlertProvider>
        <Router>
          <ScrollToTop />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

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
          </Routes>
          <Toaster />
        </Router>
      </AlertProvider>
    </AuthProvider>
  );
}

export default App;
