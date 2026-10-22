import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
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
      if (name === 'user_settings') return createSettingsCollection();
      if (name === 'sensor_readings') return createSensorReadingsCollection();
      return {
        getList: vi.fn(async () => ({ items: [] })),
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
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByRole('heading', { name: /verifica tu correo/i })).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
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
        <AlertProvider>
          <AlertProbe />
        </AlertProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Humedad baja - Riego recomendado')).toBeInTheDocument();
      expect(screen.getByText('Temperatura alta')).toBeInTheDocument();
      expect(screen.getByText('Nivel de agua bajo')).toBeInTheDocument();
    });
  });

  it('notifies in the bell when irrigation starts and finishes', async () => {
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = createAuthenticatedUser();
    let irrigationLogs = [{
      id: 'log-on',
      status: 'ON',
      created: '2026-10-20T10:00:00.000Z',
    }];
    let pollAlerts;
    const getIrrigationLogs = vi.fn(async () => ({ items: irrigationLogs }));
    const setInterval = globalThis.setInterval.bind(globalThis);
    vi.spyOn(globalThis, 'setInterval').mockImplementation((callback, delay) => {
      if (delay === 5000) pollAlerts = callback;
      return setInterval(callback, delay);
    });
    mockPb.collection.mockImplementation((name) => {
      if (name === 'sensor_readings') {
        return {
          getList: vi.fn(async () => ({
            items: [{ soil_humidity: 50, temperature: 20, water_level: 50 }],
          })),
        };
      }
      if (name === 'irrigation_logs') {
        return { getList: getIrrigationLogs };
      }
      return createSettingsCollection();
    });

    const { unmount } = render(
      <AuthProvider>
        <AlertProvider>
          <NotificationBell />
        </AlertProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getIrrigationLogs).toHaveBeenCalled();
    });

    irrigationLogs = [
      { id: 'log-off', status: 'OFF', created: '2026-10-20T10:10:00.000Z' },
      { id: 'log-on', status: 'ON', created: '2026-10-20T10:00:00.000Z' },
    ];
    await act(async () => {
      await pollAlerts();
    });

    await userEvent.setup().click(screen.getByRole('button'));
    expect(await screen.findByText('El riego ha finalizado')).toBeInTheDocument();

    irrigationLogs = [
      { id: 'log-on-2', status: 'ON', created: '2026-10-20T10:15:00.000Z' },
      ...irrigationLogs,
    ];
    await act(async () => {
      await pollAlerts();
    });
    expect(await screen.findByText('Nuevo riego iniciado')).toBeInTheDocument();
    unmount();
  });

  it('stores and calculates irrigation schedules correctly', async () => {
    const user = userEvent.setup();
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = createAuthenticatedUser();

    function ScheduleProbe() {
      const { schedules, addSchedule, getNextScheduledTime } = useIrrigationSchedule();

      return (
        <div>
          <span data-testid="schedule-count">{schedules.length}</span>
          <span data-testid="next-time">{getNextScheduledTime()?.toISOString() ?? 'none'}</span>
          <button onClick={() => addSchedule('08:30', '09:30', '2099-01-01')}>add</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <MemoryRouter>
          <ScheduleProbe />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('schedule-count')).toHaveTextContent('0');
    });

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
    const getSettings = vi.fn(async () => ({ items: [] }));
    const createSettings = vi.fn(async (payload) => ({ id: 'settings-new', ...payload }));
    mockPb.collection.mockImplementation((name) => {
      if (name === 'user_settings') {
        return { getList: getSettings, create: createSettings };
      }
      return { getList: vi.fn(async () => ({ items: [] })) };
    });

    function ScheduleProbe() {
      const { schedules, addSchedule } = useIrrigationSchedule();
      return (
        <div>
          <span data-testid="schedule-count">{schedules.length}</span>
          <button onClick={() => addSchedule('08:30', '09:30', '2099-01-01')}>save</button>
        </div>
      );
    }

    try {
      const user = userEvent.setup();
      render(
        <AuthProvider>
          <ScheduleProbe />
        </AuthProvider>
      );

      await user.click(screen.getByRole('button', { name: /save/i }));
      await waitFor(() => {
        expect(screen.getByTestId('schedule-count')).toHaveTextContent('1');
      });
      expect(createSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          irrigation_schedule_times: expect.any(String),
        }),
        { $autoCancel: false }
      );
      const savedSchedule = JSON.parse(createSettings.mock.calls[0][0].irrigation_schedule_times)[0];
      expect(savedSchedule).toMatchObject({
        date: '2099-01-01',
        startTime: '08:30',
        endTime: '09:30',
        utcOffsetMinutes: expect.any(Number),
      });
      expect(savedSchedule.id).toMatch(/^schedule-/);
    } finally {
      vi.stubGlobal('crypto', originalCrypto);
    }
  });

  it('updates an existing settings record if it appears before a schedule is saved', async () => {
    const user = userEvent.setup();
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = createAuthenticatedUser();
    const getSettings = vi.fn()
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        items: [{ id: 'settings-existing', irrigation_schedule_times: '[]' }],
      });
    const updateSettings = vi.fn(async (id, payload) => ({ id, ...payload }));
    const createSettings = vi.fn();

    mockPb.collection.mockImplementation((name) => {
      if (name === 'user_settings') {
        return {
          getList: getSettings,
          update: updateSettings,
          create: createSettings,
        };
      }
      return { getList: vi.fn(async () => ({ items: [] })) };
    });

    function ScheduleProbe() {
      const { addSchedule } = useIrrigationSchedule();
      return <button onClick={() => addSchedule('08:30', '09:30', '2099-01-01')}>save</button>;
    }

    render(
      <AuthProvider>
        <ScheduleProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getSettings).toHaveBeenCalledTimes(1);
    });
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        'settings-existing',
        expect.objectContaining({
          userId: 'user-1',
          irrigation_schedule_times: expect.any(String),
        }),
        { $autoCancel: false }
      );
    });
    expect(createSettings).not.toHaveBeenCalled();
  });
});
