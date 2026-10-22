import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@/contexts/AuthContext';
import LoginPage from '@/pages/LoginPage';

const mockPb = vi.hoisted(() => ({
  authStore: {
    isValid: false,
    model: null,
    clear: vi.fn(),
  },
  collection: vi.fn(),
}));

vi.mock('@/lib/pocketbaseClient', () => ({
  default: mockPb,
  pocketbaseClient: mockPb,
}));

const createUsersCollection = () => ({
  authWithPassword: vi.fn(async (email, password) => {
    if (email === 'bad@demo.com' && password === 'wrong') {
      throw new Error('Failed to authenticate.');
    }
    if (email === 'unverified@demo.com') {
      const error = new Error("The request doesn't satisfy the collection requirements to authenticate.");
      error.status = 400;
      error.data = {
        message: "The request doesn't satisfy the collection requirements to authenticate.",
      };
      throw error;
    }

    const user = { id: 'u-1', email, name: 'Demo User' };
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = user;
    return { record: user };
  }),
  create: vi.fn(async (payload) => ({ id: 'u-1', ...payload })),
  getFullList: vi.fn(async () => []),
  requestOTP: vi.fn(async () => ({ otpId: 'otp-1' })),
  authWithOTP: vi.fn(async () => {
    const user = { id: 'u-1', email: 'unverified@demo.com', verified: true };
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = user;
    return { record: user };
  }),
  listAuthMethods: vi.fn(async () => ({ oauth2: { providers: [] } })),
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.authStore.isValid = false;
  mockPb.authStore.model = null;
  mockPb.collection.mockImplementation(() => createUsersCollection());
});

describe('Login page module', () => {
  it('shows a validation error when fields are empty', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    expect(screen.getByText('Por favor, completa todos los campos')).toBeInTheDocument();
  });

  it('redirects to dashboard on successful login', async () => {
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

  it('displays a clear auth error when credentials are invalid', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/correo electrónico/i), 'bad@demo.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByText(/no se pudo iniciar sesión/i)).toBeInTheDocument();
    });
  });

  it('explains that PocketBase rejected an unverified email and offers resend', async () => {
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

    await user.type(screen.getByLabelText(/correo electrónico/i), 'unverified@demo.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'a-valid-length-password');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText(/esta cuenta todavía no ha verificado su correo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar código de verificación/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /enviar código de verificación/i }));
    expect(await screen.findByLabelText(/código de verificación/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/código de verificación/i), '123456');
    await user.click(screen.getByRole('button', { name: /verificar código/i }));
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });
});
