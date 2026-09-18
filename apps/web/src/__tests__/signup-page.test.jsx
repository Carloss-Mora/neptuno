import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@/contexts/AuthContext';
import SignupPage from '@/pages/SignupPage';

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

describe('Signup page module', () => {
  it('validates required fields and email format', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));
    expect(screen.getByText('Por favor, completa todos los campos')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/nombre completo/i), 'Test User');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'admin@');
    await user.type(screen.getByLabelText(/^contraseña$/i), '12345678');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), '12345678');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(screen.getByText('Por favor, introduce un correo electrónico válido')).toBeInTheDocument();
  });

  it('requires password length and password confirmation match', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/nombre completo/i), 'Test User');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'valid@example.com');
    await user.type(screen.getByLabelText(/^contraseña$/i), '123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), '123');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^contraseña$/i));
    await user.type(screen.getByLabelText(/^contraseña$/i), '12345678');
    await user.clear(screen.getByLabelText(/confirmar contraseña/i));
    await user.type(screen.getByLabelText(/confirmar contraseña/i), '87654321');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
  });

  it('creates the account and redirects when valid', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });
});
