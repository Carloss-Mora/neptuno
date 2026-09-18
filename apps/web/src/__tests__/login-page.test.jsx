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

    const user = { id: 'u-1', email, name: 'Demo User' };
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = user;
    return { record: user };
  }),
  create: vi.fn(async (payload) => ({ id: 'u-1', ...payload })),
  getFullList: vi.fn(async () => []),
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
      expect(screen.getByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
    });
  });
});
