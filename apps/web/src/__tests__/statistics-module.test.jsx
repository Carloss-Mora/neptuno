import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AuthProvider } from '@/contexts/AuthContext';
import { AlertProvider } from '@/contexts/AlertContext';
import StatisticsPage from '@/pages/StatisticsPage';

const mockPb = vi.hoisted(() => ({
  authStore: {
    isValid: true,
    model: { id: 'user-1', email: 'farmer@example.com', name: 'Farmer' },
    clear: vi.fn(),
  },
  collection: vi.fn(),
}));

vi.mock('@/lib/pocketbaseClient', () => ({
  default: mockPb,
  pocketbaseClient: mockPb,
}));

describe('Irrigation statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = { id: 'user-1', email: 'farmer@example.com', name: 'Farmer' };
  });

  it('calculates irrigation sessions and duration from on/off records', async () => {
    const now = Math.floor(Date.now() / 60000) * 60000;
    const sessionStart = new Date(now - 90 * 60000);
    const sessionEnd = new Date(now - 30 * 60000);
    const expectedTodayLiters = sessionStart.toDateString() === new Date(now).toDateString() ? '12.0' : '0.0';
    const logs = [
      { id: 'on-1', userId: 'user-1', status: 'ON', source: 'MANUAL', created: sessionStart.toISOString() },
      { id: 'off-1', userId: 'user-1', status: 'OFF', source: 'MANUAL', created: sessionEnd.toISOString() },
    ];

    mockPb.collection.mockImplementation((name) => ({
      getList: vi.fn(async () => ({
        items: name === 'user_settings' ? [{ cultivated_area_m2: 120 }] : [],
      })),
      getFullList: vi.fn(async () => (name === 'irrigation_logs' ? logs : [])),
    }));

    render(
      <AuthProvider>
        <AlertProvider>
          <MemoryRouter>
            <StatisticsPage />
          </MemoryRouter>
        </AlertProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Riegos iniciados').parentElement.parentElement).toHaveTextContent('1');
    });
    expect(screen.getByTestId('total-irrigation-runtime')).toHaveTextContent('1 h 00 min');
    expect(screen.getByText('Duración promedio').parentElement.parentElement).toHaveTextContent('1 h 00 min');
    expect(screen.getByText('Consumo estimado hoy').parentElement.parentElement).toHaveTextContent(`${expectedTodayLiters} L`);
    expect(screen.getByText('Mes actual').parentElement.parentElement).toHaveTextContent('12.0 L');
    expect(screen.getByText('Comparación mensual estimada')).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hay sesiones de riego/i)).not.toBeInTheDocument();
  });

  it('explains how to populate statistics when no irrigation logs exist', async () => {
    mockPb.collection.mockImplementation(() => ({
      getList: vi.fn(async () => ({ items: [] })),
      getFullList: vi.fn(async () => []),
    }));

    render(
      <AuthProvider>
        <AlertProvider>
          <MemoryRouter>
            <StatisticsPage />
          </MemoryRouter>
        </AlertProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Activa el riego desde el panel de control/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('0 min').length).toBeGreaterThan(0);
  });
});
