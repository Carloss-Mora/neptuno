import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CropProvider, useCrop } from '@/contexts/CropContext';
import { AlertProvider, useAlert } from '@/contexts/AlertContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import NotificationBell from '@/components/NotificationBell';
import { useIrrigationSchedule } from '@/hooks/useIrrigationSchedule';

const mockPb = vi.hoisted(() => ({
  authStore: {
    isValid: false,
    model: null,
    clear: vi.fn(),
  },
  files: {
    getUrl: vi.fn(() => 'https://example.com/avatar.png'),
  },
  collection: vi.fn(),
}));

vi.mock('@/lib/pocketbaseClient', () => ({
  default: mockPb,
  pocketbaseClient: mockPb,
}));

const mockFetch = vi.hoisted(() => vi.fn());

vi.stubGlobal('fetch', mockFetch);

const createAuthenticatedUser = () => ({
  id: 'user-1',
  email: 'user@test.com',
  name: 'Test User',
});

const createUsersCollection = () => ({
  authWithPassword: vi.fn(async (email, password) => {
    const user = createAuthenticatedUser();
    user.email = email;
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = user;

    if (email === 'bad@demo.com' && password === 'wrong') {
      throw new Error('Credenciales inválidas');
    }

    return { record: user };
  }),
  create: vi.fn(async (payload) => ({
    id: 'user-1',
    ...payload,
  })),
  requestOTP: vi.fn(async () => ({ otpId: 'otp-1' })),
  listAuthMethods: vi.fn(async () => ({ oauth2: { providers: [] } })),
});

const createSettingsCollection = () => ({
  getList: vi.fn(async () => ({ items: [] })),
  create: vi.fn(async (payload) => ({ id: 'settings-1', ...payload })),
  update: vi.fn(async (id, payload) => ({ id, ...payload })),
});

const createCropsCollection = () => ({
  getFullList: vi.fn(async () => [{
    id: 'crop-1',
    userId: 'user-1',
    name: 'Fresas',
    area_m2: 120,
    humidity_min: 30,
    humidity_max: 60,
    alert_water_min: 20,
    control_mode: 'MANUAL',
  }]),
});

const createSensorReadingsCollection = () => ({
  getList: vi.fn(async () => ({
    items: [{
      id: 'reading-1',
      soil_humidity: 18,
      temperature: 38,
      water_level: 12,
      created: '2024-01-01T00:00:00.000Z',
    }],
  })),
  subscribe: vi.fn(async () => vi.fn()),
});

describe('Neptuno app behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockFetch.mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    });

    mockPb.authStore.isValid = false;
    mockPb.authStore.model = null;
    mockPb.collection.mockImplementation((name) => {
      if (name === 'users') return createUsersCollection();
      if (name === 'crops') return createCropsCollection();
      if (name === 'user_settings') return createSettingsCollection();
      if (name === 'sensor_readings') return createSensorReadingsCollection();
      return {
        getList: vi.fn(async () => ({ items: [] })),
        getFullList: vi.fn(async () => []),
        subscribe: vi.fn(async () => vi.fn()),
        create: vi.fn(async (payload) => ({ id: 'record-1', ...payload })),
        update: vi.fn(async (id, payload) => ({ id, ...payload })),
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs in, keeps the user session and logs out', async () => {
    const user = userEvent.setup();

    function AuthProbe() {
      const { currentUser, login, logout, isAuthenticated } = useAuth();

      return (
        <div>
          <span>{isAuthenticated ? 'authenticated' : 'guest'}</span>
          <span>{currentUser?.email ?? 'no-user'}</span>
          <button onClick={() => login('user@test.com', '12345678')}>login</button>
          <button onClick={logout}>logout</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('authenticated')).toBeInTheDocument();
      expect(screen.getByText('user@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => {
      expect(screen.getByText('guest')).toBeInTheDocument();
      expect(screen.getByText('no-user')).toBeInTheDocument();
      expect(mockPb.authStore.clear).toHaveBeenCalled();
    });
  });

  it('redirects unauthenticated users away from protected routes', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard</div></ProtectedRoute>} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('validates the login form and navigates on success', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/correo electrónico/i), 'user@test.com');
    await user.type(screen.getByLabelText(/contraseña/i), '12345678');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('creates the account and shows the email verification notice', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/nombre completo/i), 'Test User');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^contraseña$/i), '12345678');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), '12345678');
    await user.click(screen.getByRole('checkbox', { name: /acepto/i }));
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByRole('heading', { name: /verifica tu correo/i })).toBeInTheDocument();
    expect(screen.getAllByText(/test@example.com/i).length).toBeGreaterThan(0);
  });

  it('muestra mensajes claros para validaciones de signup y correo duplicado', async () => {
    const user = userEvent.setup();
    const usersCollection = createUsersCollection();
    usersCollection.getFullList = vi.fn(async () => [{ email: 'valid@example.com' }]);
    usersCollection.create.mockRejectedValueOnce({
      response: {
        data: {
          message: 'The email is already registered.',
        },
      },
    });
    mockPb.collection.mockImplementation((name) => {
      if (name === 'users') return usersCollection;
      if (name === 'user_settings') return createSettingsCollection();
      return createSensorReadingsCollection();
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/nombre completo/i), 'Test User');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'admin@');
    await user.type(screen.getByLabelText(/^contraseña$/i), '12345678');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), '12345678');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(screen.getByText('Por favor, introduce un correo electrónico válido')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/correo electrónico/i));
    await user.type(screen.getByLabelText(/correo electrónico/i), 'valid@example.com');
    await user.clear(screen.getByLabelText(/^contraseña$/i));
    await user.type(screen.getByLabelText(/^contraseña$/i), '123');
    await user.clear(screen.getByLabelText(/confirmar contraseña/i));
    await user.type(screen.getByLabelText(/confirmar contraseña/i), '123');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^contraseña$/i));
    await user.type(screen.getByLabelText(/^contraseña$/i), '12345678');
    await user.clear(screen.getByLabelText(/confirmar contraseña/i));
    await user.type(screen.getByLabelText(/confirmar contraseña/i), '87654321');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/confirmar contraseña/i));
    await user.type(screen.getByLabelText(/confirmar contraseña/i), '12345678');
    await user.click(screen.getByRole('checkbox', { name: /acepto/i }));
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText('El correo valid@example.com ya tiene una cuenta asociada.')).toBeInTheDocument();
    });
  });

  it('muestra un mensaje claro cuando el backend responde con un error genérico para un correo duplicado', async () => {
    const user = userEvent.setup();
    const usersCollection = createUsersCollection();
    usersCollection.getFullList = vi.fn(async () => [{ email: 'duplicado@example.com' }]);
    mockPb.collection.mockImplementation((name) => {
      if (name === 'users') return usersCollection;
      if (name === 'user_settings') return createSettingsCollection();
      return createSensorReadingsCollection();
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/nombre completo/i), 'Duplicado');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'duplicado@example.com');
    await user.type(screen.getByLabelText(/^contraseña$/i), '12345678');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), '12345678');
    await user.click(screen.getByRole('checkbox', { name: /acepto/i }));
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText('El correo duplicado@example.com ya tiene una cuenta asociada.')).toBeInTheDocument();
    });
  });

  it('adds irrigation alerts when sensor thresholds are crossed', async () => {
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = createAuthenticatedUser();

    function AlertProbe() {
      const { alerts } = useAlert();
      return <div>{alerts.map((alert) => <span key={alert.id}>{alert.message}</span>)}</div>;
    }

    render(
      <AuthProvider>
        <CropProvider>
          <AlertProvider>
            <AlertProbe />
          </AlertProvider>
        </CropProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Humedad bajo el mínimo configurado (30%)')).toBeInTheDocument();
      expect(screen.getByText('Nivel de agua bajo')).toBeInTheDocument();
    });
    expect(screen.queryByText('Temperatura alta')).not.toBeInTheDocument();
  });

  it('notifies in the bell when irrigation starts and finishes', async () => {
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = createAuthenticatedUser();
    let irrigationLogs = [{
      id: 'log-on',
      cropId: 'crop-1',
      status: 'ON',
      created: '2026-10-20T10:00:00.000Z',
    }];
    let logSubscriber;
    const getIrrigationLogs = vi.fn(async () => ({ items: irrigationLogs }));
    mockPb.collection.mockImplementation((name) => {
      if (name === 'crops') return createCropsCollection();
      if (name === 'sensor_readings') {
        return {
          getList: vi.fn(async () => ({
            items: [{ soil_humidity: 50, temperature: 20, water_level: 50 }],
          })),
          subscribe: vi.fn(async () => vi.fn()),
        };
      }
      if (name === 'irrigation_logs') {
        return {
          getList: getIrrigationLogs,
          subscribe: vi.fn(async (topic, callback) => {
            logSubscriber = callback;
            return vi.fn();
          }),
        };
      }
      return {
        getFullList: vi.fn(async () => []),
        subscribe: vi.fn(async () => vi.fn()),
      };
    });

    const { unmount } = render(
      <AuthProvider>
        <CropProvider>
          <AlertProvider>
            <NotificationBell />
          </AlertProvider>
        </CropProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getIrrigationLogs).toHaveBeenCalled();
    });

    irrigationLogs = [
      { id: 'log-off', cropId: 'crop-1', status: 'OFF', created: '2026-10-20T10:10:00.000Z' },
      { id: 'log-on', status: 'ON', created: '2026-10-20T10:00:00.000Z' },
    ];
    await act(async () => logSubscriber({ action: 'create', record: irrigationLogs[0] }));

    await userEvent.setup().click(screen.getByRole('button'));
    expect(await screen.findByText('El riego ha finalizado')).toBeInTheDocument();

    irrigationLogs = [
      { id: 'log-on-2', cropId: 'crop-1', status: 'ON', created: '2026-10-20T10:15:00.000Z' },
      ...irrigationLogs,
    ];
    await act(async () => logSubscriber({ action: 'create', record: irrigationLogs[0] }));
    expect(await screen.findByText('Nuevo riego iniciado')).toBeInTheDocument();
    unmount();
  });

  it('stores and calculates irrigation schedules correctly', async () => {
    const user = userEvent.setup();
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = createAuthenticatedUser();

    function ScheduleProbe() {
      const { schedules, addSchedule, getNextScheduledTime } = useIrrigationSchedule();
      const { selectedCrop } = useCrop();

      return (
        <div>
          <span data-testid="selected-crop">{selectedCrop?.id || 'none'}</span>
          <span data-testid="schedule-count">{schedules.length}</span>
          <span data-testid="next-time">{getNextScheduledTime()?.toISOString() ?? 'none'}</span>
          <button onClick={() => addSchedule('08:30', '09:30', '2099-01-01')}>add</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <CropProvider>
          <MemoryRouter>
            <ScheduleProbe />
          </MemoryRouter>
        </CropProvider>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('selected-crop')).toHaveTextContent('crop-1'));

    await user.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(screen.getByTestId('schedule-count')).toHaveTextContent('1');
      expect(screen.getByTestId('next-time')).not.toHaveTextContent('none');
    });
  });

  it('saves a schedule when the browser does not provide crypto.randomUUID', async () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {});
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = createAuthenticatedUser();
    const createSchedule = vi.fn(async (payload) => ({ id: 'schedule-1', ...payload }));
    const getSchedules = vi.fn(async () => []);
    mockPb.collection.mockImplementation((name) => {
      if (name === 'crops') return createCropsCollection();
      if (name === 'irrigation_schedules') {
        return { getFullList: getSchedules, create: createSchedule };
      }
      return { getList: vi.fn(async () => ({ items: [] })), getFullList: vi.fn(async () => []) };
    });

    function ScheduleProbe() {
      const { schedules, addSchedule } = useIrrigationSchedule();
      const { selectedCrop } = useCrop();
      return (
        <div>
          <span data-testid="selected-crop">{selectedCrop?.id || 'none'}</span>
          <span data-testid="schedule-count">{schedules.length}</span>
          <button onClick={() => addSchedule('08:30', '09:30', '2099-01-01')}>save</button>
        </div>
      );
    }

    try {
      const user = userEvent.setup();
      render(
        <AuthProvider>
          <CropProvider>
            <ScheduleProbe />
          </CropProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('selected-crop')).toHaveTextContent('crop-1'));
      await user.click(screen.getByRole('button', { name: /save/i }));
      await waitFor(() => {
        expect(screen.getByTestId('schedule-count')).toHaveTextContent('1');
      });
      expect(createSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          cropId: 'crop-1',
          date: '2099-01-01',
          startTime: '08:30',
          endTime: '09:30',
          recurrence: 'ONCE',
        }),
        { $autoCancel: false }
      );
    } finally {
      vi.stubGlobal('crypto', originalCrypto);
    }
  });

  it('updates a schedule in the selected crop collection', async () => {
    const user = userEvent.setup();
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = createAuthenticatedUser();
    const updateSchedule = vi.fn(async (id, payload) => ({ id, ...payload }));

    mockPb.collection.mockImplementation((name) => {
      if (name === 'crops') return createCropsCollection();
      if (name === 'irrigation_schedules') {
        return {
          getFullList: vi.fn(async () => []),
          update: updateSchedule,
        };
      }
      return { getList: vi.fn(async () => ({ items: [] })), getFullList: vi.fn(async () => []) };
    });

    function ScheduleProbe() {
      const { updateSchedule: update } = useIrrigationSchedule();
      const { selectedCrop } = useCrop();
      return (
        <div>
          <span data-testid="selected-crop">{selectedCrop?.id || 'none'}</span>
          <button onClick={() => update('schedule-1', '08:30', '09:30', '2099-01-01')}>update</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <CropProvider>
          <ScheduleProbe />
        </CropProvider>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('selected-crop')).toHaveTextContent('crop-1'));
    await user.click(screen.getByRole('button', { name: /update/i }));

    await waitFor(() => {
      expect(updateSchedule).toHaveBeenCalledWith(
        'schedule-1',
        expect.objectContaining({
          date: '2099-01-01',
          startTime: '08:30',
          endTime: '09:30',
        }),
        { $autoCancel: false }
      );
    });
  });
});
