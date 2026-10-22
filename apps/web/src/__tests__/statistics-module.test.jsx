import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AuthProvider } from '@/contexts/AuthContext';
import { CropProvider } from '@/contexts/CropContext';
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
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const minutesToday = Math.max(
      0,
      Math.min(sessionEnd.getTime(), now) - Math.max(sessionStart.getTime(), todayStart.getTime()),
    ) / 60000;
    const expectedTodayLiters = (minutesToday * 0.2).toFixed(1);
    const logs = [
      { id: 'on-1', userId: 'user-1', status: 'ON', source: 'MANUAL', created: sessionStart.toISOString() },
      { id: 'off-1', userId: 'user-1', status: 'OFF', source: 'MANUAL', created: sessionEnd.toISOString() },
    ];

    mockPb.collection.mockImplementation((name) => ({
      getList: vi.fn(async () => ({ items: [] })),
      getFullList: vi.fn(async () => (name === 'crops'
        ? [{ id: 'crop-1', userId: 'user-1', name: 'Fresas', flow_lpm: 0.2 }]
        : name === 'irrigation_logs' ? logs : [])),
      subscribe: vi.fn(async () => vi.fn()),
    }));

    render(
      <AuthProvider>
        <CropProvider>
          <AlertProvider>
            <MemoryRouter>
              <StatisticsPage />
            </MemoryRouter>
          </AlertProvider>
        </CropProvider>
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
    mockPb.collection.mockImplementation((name) => ({
      getList: vi.fn(async () => ({ items: [] })),
      getFullList: vi.fn(async () => (name === 'crops' ? [{ id: 'crop-1', userId: 'user-1', name: 'Fresas', flow_lpm: 0.2 }] : [])),
      subscribe: vi.fn(async () => vi.fn()),
    }));

    render(
      <AuthProvider>
        <CropProvider>
          <AlertProvider>
            <MemoryRouter>
              <StatisticsPage />
            </MemoryRouter>
          </AlertProvider>
        </CropProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Activa el riego desde el panel de control/i).length).toBeGreaterThan(0);
    });
    expect(await screen.findAllByText('0 min')).not.toHaveLength(0);
  });

  it('combines recent sensor readings with archived hourly averages', async () => {
    mockPb.collection.mockImplementation((name) => ({
      getList: vi.fn(async () => ({ items: [] })),
      getFullList: vi.fn(async () => {
        if (name === 'crops') return [{ id: 'crop-1', userId: 'user-1', name: 'Fresas', flow_lpm: 0.2 }];
        if (name === 'sensor_readings') return [{ soil_humidity: 40, is_demo: false }];
        if (name === 'sensor_readings_hourly') return [{ humidity_avg: 60, sample_count: 3, is_demo: true }];
        return [];
      }),
      subscribe: vi.fn(async () => vi.fn()),
    }));

    render(
      <AuthProvider>
        <CropProvider>
          <AlertProvider>
            <MemoryRouter>
              <StatisticsPage />
            </MemoryRouter>
          </AlertProvider>
        </CropProvider>
      </AuthProvider>
    );

    expect(await screen.findByText('55.0%')).toBeInTheDocument();
    expect(screen.getByText(/4 muestras · lecturas recientes y promedios horarios · Demo/)).toBeInTheDocument();
  });
});
