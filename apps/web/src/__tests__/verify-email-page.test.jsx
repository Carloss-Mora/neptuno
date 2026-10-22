import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import VerifyEmailPage from '@/pages/VerifyEmailPage';

const mockPb = vi.hoisted(() => ({
  authStore: { isValid: false, model: null, clear: vi.fn() },
  collection: vi.fn(),
}));

vi.mock('@/lib/pocketbaseClient', () => ({
  default: mockPb,
  pocketbaseClient: mockPb,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.collection.mockImplementation(() => ({
    confirmVerification: vi.fn(async () => ({})),
  }));
});

describe('Email verification page', () => {
  it('confirms the token from the link and displays success', async () => {
    const confirmVerification = vi.fn(async () => ({}));
    mockPb.collection.mockImplementation(() => ({ confirmVerification }));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/verify-email?token=verification-token']}>
          <Routes>
            <Route path="/verify-email" element={<VerifyEmailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByText(/tu correo quedó verificado/i)).toBeInTheDocument();
    expect(confirmVerification).toHaveBeenCalledWith('verification-token', { $autoCancel: false });
  });

  it('shows a useful error when the link has no token', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/verify-email']}>
          <Routes>
            <Route path="/verify-email" element={<VerifyEmailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/no contiene un token/i);
  });
});
