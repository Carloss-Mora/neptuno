import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@/contexts/AuthContext';
import { CropProvider } from '@/contexts/CropContext';
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

const defaultCrop = {
  id: 'crop-1',
  userId: 'user-1',
  name: 'Fresas',
  area_m2: 120,
  flow_lpm: 0.2,
  control_mode: 'MANUAL',
};

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
        subscribe: vi.fn(async () => vi.fn()),
      };
    }

    if (name === 'crops') {
      return {
        getFullList: vi.fn(async () => [{ ...defaultCrop }]),
        update: vi.fn(async (id, payload) => ({ ...defaultCrop, id, ...payload })),
      };
    }

    return {
      getList: vi.fn(async () => ({ items: [] })),
      getFullList: vi.fn(async () => []),
      subscribe: vi.fn(async () => vi.fn()),
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
        <CropProvider>
          <AlertProvider>
            <MemoryRouter initialEntries={['/dashboard']}>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Routes>
            </MemoryRouter>
          </AlertProvider>
        </CropProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Panel Principal' })).toBeInTheDocument();
      expect(screen.getByText('Humedad del Suelo')).toBeInTheDocument();
      expect(screen.getByText('Horario de Riego')).toBeInTheDocument();
      expect(screen.getByText('Consumo estimado hoy')).toBeInTheDocument();
    });
  });

  it('shows a scheduled irrigation as active even when the latest manual stop is from before it', async () => {
    const now = new Date();
    const scheduleDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const staleManualStop = {
      id: 'old-off',
      status: 'OFF',
      source: 'MANUAL',
      created: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    };

    mockPb.collection.mockImplementation((name) => {
      if (name === 'crops') return { getFullList: vi.fn(async () => [{ ...defaultCrop }]) };
      if (name === 'sensor_readings') {
        return { getList: vi.fn(async () => ({ items: [] })), subscribe: vi.fn(async () => vi.fn()) };
      }
      if (name === 'irrigation_schedules') {
        return {
          getFullList: vi.fn(async () => [{
              id: 'schedule-active',
              date: scheduleDate,
              startTime: '00:00',
              endTime: '23:59',
              recurrence: 'ONCE',
            }]),
        };
      }
      return {
        getFullList: vi.fn(async () => [staleManualStop]),
      };
    });

    render(
      <AuthProvider>
        <CropProvider>
          <AlertProvider>
            <MemoryRouter initialEntries={['/dashboard']}>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Routes>
            </MemoryRouter>
          </AlertProvider>
        </CropProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Riego activo')).toBeInTheDocument();
      expect(screen.getByText('En curso')).toBeInTheDocument();
    });
  });

  it('does not show past schedules as the next irrigation or call an inactive system waiting', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const scheduleDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    mockPb.collection.mockImplementation((name) => {
      if (name === 'crops') return { getFullList: vi.fn(async () => [{ ...defaultCrop }]) };
      if (name === 'sensor_readings') {
        return { getList: vi.fn(async () => ({ items: [] })), subscribe: vi.fn(async () => vi.fn()) };
      }
      if (name === 'irrigation_schedules') {
        return {
          getFullList: vi.fn(async () => [{
            id: 'schedule-past',
            date: scheduleDate,
            startTime: '08:00',
            endTime: '09:00',
            recurrence: 'ONCE',
          }]),
        };
      }
      return {
        getFullList: vi.fn(async () => [{
          id: 'old-off',
          status: 'OFF',
          source: 'AUTOMATIC',
          created: new Date().toISOString(),
        }]),
      };
    });

    render(
      <AuthProvider>
        <CropProvider>
          <AlertProvider>
            <MemoryRouter initialEntries={['/dashboard']}>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Routes>
            </MemoryRouter>
          </AlertProvider>
        </CropProvider>
      </AuthProvider>
    );

    expect(await screen.findByText('Riego inactivo')).toBeInTheDocument();
    expect(screen.getByText('Sin riegos pendientes')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Los horarios guardados ya pasaron.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Próximo riego')).not.toBeInTheDocument();
  });

  it('opens the mobile navigation with access to all dashboard sections', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <CropProvider>
          <AlertProvider>
            <MemoryRouter initialEntries={['/dashboard']}>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Routes>
            </MemoryRouter>
          </AlertProvider>
        </CropProvider>
      </AuthProvider>
    );

    await screen.findByRole('heading', { name: 'Panel Principal' });
    await waitFor(() => {
      expect(document.querySelector('select[aria-label="Cultivo seleccionado"]')?.value).toBe('crop-1');
    });
    const menuButton = await screen.findByRole('button', { name: 'Abrir menú' });
    await user.click(menuButton);
    expect(await screen.findByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true');

    const menu = await screen.findByRole('navigation', { name: 'Menú móvil' });
    expect(within(menu).getByRole('link', { name: 'Inicio' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Panel de Control' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Estadísticas' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Historial de Riego' })).toBeInTheDocument();
  });

  it('saves cultivated area in the selected crop record', async () => {
    const user = userEvent.setup();
    const storedCrop = {
      ...defaultCrop,
      userId: 'user-1',
      area_m2: 100,
    };
    const updateCrop = vi.fn(async (id, payload) => {
      Object.assign(storedCrop, payload);
      return { ...storedCrop, id };
    });
    mockPb.collection.mockImplementation((name) => {
      if (name === 'crops') return {
        getFullList: vi.fn(async () => [{ ...storedCrop }]),
        update: updateCrop,
      };
      if (name === 'sensor_readings') {
        return { getList: vi.fn(async () => ({ items: [] })), subscribe: vi.fn(async () => vi.fn()) };
      }
      return { getList: vi.fn(async () => ({ items: [] })), getFullList: vi.fn(async () => []), subscribe: vi.fn(async () => vi.fn()) };
    });

    const dashboard = () => (
      <AuthProvider>
        <CropProvider>
          <AlertProvider>
            <MemoryRouter initialEntries={['/dashboard']}>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Routes>
            </MemoryRouter>
          </AlertProvider>
        </CropProvider>
      </AuthProvider>
    );
    const { unmount } = render(dashboard());

    await user.click(await screen.findByRole('button', { name: 'Modificar área' }));
    const areaInput = await screen.findByLabelText('Área total del cultivo');
    await user.clear(areaInput);
    await user.type(areaInput, '250');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(updateCrop).toHaveBeenCalledWith(
        'crop-1',
        expect.objectContaining({ area_m2: 250 }),
        { $autoCancel: false },
      );
    });
    expect(screen.getByRole('status')).toHaveTextContent('Área guardada.');
    expect(screen.getByText('Área total registrada: 250 m²')).toBeInTheDocument();
    expect(screen.getByText('0.2 L/min × duración real')).toBeInTheDocument();
    await waitFor(() => {
      expect(storedCrop.area_m2).toBe(250);
      expect(screen.getByText('Área total registrada: 250 m²')).toBeInTheDocument();
    }, { timeout: 6000 });

    unmount();
    render(dashboard());
    expect(await screen.findByText('Área total registrada: 250 m²')).toBeInTheDocument();
  });
});
