import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@/contexts/AuthContext';
import { AlertProvider } from '@/contexts/AlertContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardPage from '@/pages/DashboardPage';

const mockPb = vi.hoisted(() => ({
  authStore: {
    isValid: true,
    model: {
      id: 'user-1',
      email: 'user@test.com',
      name: 'Test User',
    },
    clear: vi.fn(),
  },
  collection: vi.fn(),
}));

vi.mock('@/lib/pocketbaseClient', () => ({
  default: mockPb,
  pocketbaseClient: mockPb,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.authStore.isValid = true;
  mockPb.authStore.model = {
    id: 'user-1',
    email: 'user@test.com',
    name: 'Test User',
  };

  mockPb.collection.mockImplementation((name) => {
    if (name === 'sensor_readings') {
      return {
        getList: vi.fn(async () => ({
          items: [
            {
              id: 'reading-1',
              soil_humidity: 34,
              temperature: 28,
              water_level: 71,
              created: '2024-01-01T00:00:00.000Z',
              userId: 'user-1',
            },
          ],
        })),
      };
    }

    if (name === 'user_settings') {
      return {
        getList: vi.fn(async () => ({
          items: [
            {
              id: 'settings-1',
              userId: 'user-1',
              irrigation_schedule_times: '08:00,12:00,18:00',
            },
          ],
        })),
      };
    }

    return {
      getList: vi.fn(async () => ({ items: [] })),
      create: vi.fn(async (payload) => ({ id: 'record-1', ...payload })),
      update: vi.fn(async (id, payload) => ({ id, ...payload })),
    };
  });
});

describe('Dashboard and route module', () => {
  it('redirects unauthenticated users away from protected routes', async () => {
    mockPb.authStore.isValid = false;
    mockPb.authStore.model = null;

    render(
      <AuthProvider>
        <AlertProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard</div></ProtectedRoute>} />
              <Route path="/login" element={<div>Login Page</div>} />
            </Routes>
          </MemoryRouter>
        </AlertProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('loads sensor data and irrigation schedule for the active user', async () => {
    render(
      <AuthProvider>
        <AlertProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
          </MemoryRouter>
        </AlertProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Panel Principal')).toBeInTheDocument();
      expect(screen.getByText('Humedad del Suelo')).toBeInTheDocument();
      expect(screen.getByText('Horario de Riego')).toBeInTheDocument();
    });
  });
});
