import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';

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

    const user = {
      id: 'user-1',
      email,
      name: 'Test User',
    };
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = user;
    return { record: user };
  }),
  authWithOTP: vi.fn(async (otpId, code) => {
    const user = { id: 'user-1', email: 'new@example.com', verified: true };
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = user;
    return { record: user };
  }),
  create: vi.fn(async (payload) => ({
    id: 'user-1',
    ...payload,
  })),
  getFullList: vi.fn(async () => []),
  getList: vi.fn(async () => ({ items: [] })),
  requestOTP: vi.fn(async () => ({ otpId: 'otp-1' })),
  listAuthMethods: vi.fn(async () => ({ oauth2: { providers: [] } })),
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.authStore.isValid = false;
  mockPb.authStore.model = null;
  mockPb.collection.mockImplementation((name) => {
    if (name === 'users') return createUsersCollection();
    return {
      getList: vi.fn(async () => ({ items: [] })),
      create: vi.fn(async (payload) => ({ id: 'record-1', ...payload })),
      update: vi.fn(async (id, payload) => ({ id, ...payload })),
    };
  });
});

describe('Auth module', () => {
  it('logs in, keeps the session and logs out', async () => {
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

  it('creates the user account without authenticating before verification', async () => {
    const user = userEvent.setup();

    function AuthProbe() {
      const { signup, currentUser, isAuthenticated } = useAuth();
      return (
        <div>
          <span>{isAuthenticated ? 'authenticated' : 'guest'}</span>
          <span>{currentUser?.email ?? 'no-user'}</span>
          <button onClick={() => signup('new@example.com', '12345678', '12345678', 'New User')}>signup</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await user.click(screen.getByRole('button', { name: /signup/i }));

    await waitFor(() => {
      expect(screen.getByText('guest')).toBeInTheDocument();
      expect(screen.getByText('no-user')).toBeInTheDocument();
    });
  });

  it('verifies an email code and starts an authenticated session', async () => {
    const user = userEvent.setup();

    function AuthProbe() {
      const { verifyEmailCode, currentUser, isAuthenticated } = useAuth();
      return (
        <>
          <span>{isAuthenticated ? 'authenticated' : 'guest'}</span>
          <span>{currentUser?.email ?? 'no-user'}</span>
          <button onClick={() => verifyEmailCode('otp-1', '123456')}>verify</button>
        </>
      );
    }

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: /verify/i }));
    await waitFor(() => {
      expect(screen.getByText('authenticated')).toBeInTheDocument();
      expect(screen.getByText('new@example.com')).toBeInTheDocument();
    });
  });

  it('clears a previously stored session for an unverified user', async () => {
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = { id: 'user-unverified', verified: false };

    function AuthProbe() {
      const { isAuthenticated } = useAuth();
      return <span>{isAuthenticated ? 'authenticated' : 'guest'}</span>;
    }

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('guest')).toBeInTheDocument();
      expect(mockPb.authStore.clear).toHaveBeenCalled();
    });
  });

  it('does not create a session if PocketBase returns an unverified account', async () => {
    const usersCollection = createUsersCollection();
    usersCollection.authWithPassword = vi.fn(async () => {
      mockPb.authStore.isValid = true;
      mockPb.authStore.model = { id: 'user-unverified', verified: false };
      return { record: mockPb.authStore.model };
    });
    mockPb.collection.mockImplementation((name) => (
      name === 'users' ? usersCollection : {}
    ));

    function AuthProbe() {
      const { login, isAuthenticated } = useAuth();
      const [error, setError] = React.useState('');
      const handleLogin = async () => {
        try {
          await login('user@example.com', 'correct-password');
        } catch (loginError) {
          setError(loginError.message);
        }
      };
      return (
        <>
          <span>{isAuthenticated ? 'authenticated' : 'guest'}</span>
          <button onClick={handleLogin}>login</button>
          {error && <span>{error}</span>}
        </>
      );
    }

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByText(/esta cuenta todavía no ha verificado su correo/i)).toBeInTheDocument();
    expect(screen.getByText('guest')).toBeInTheDocument();
    expect(mockPb.authStore.clear).toHaveBeenCalled();
    expect(usersCollection.requestOTP).toHaveBeenCalledWith('user@example.com', { $autoCancel: false });
  });

  it('returns a clear duplicate-email message when PocketBase reports validation_not_unique', async () => {
    const usersCollection = createUsersCollection();
    usersCollection.create = vi.fn(async () => {
      const error = new Error('Failed to create record.');
      error.data = {
        email: {
          code: 'validation_not_unique',
          message: 'Value must be unique.',
        },
      };
      throw error;
    });
    mockPb.collection.mockImplementation((name) => {
      if (name === 'users') return usersCollection;
      return {
        getList: vi.fn(async () => ({ items: [] })),
        create: vi.fn(async (payload) => ({ id: 'record-1', ...payload })),
        update: vi.fn(async (id, payload) => ({ id, ...payload })),
      };
    });

    function AuthProbe() {
      const { signup } = useAuth();
      const [error, setError] = React.useState('');

      const handleClick = async () => {
        try {
          await signup('duplicate@example.com', '12345678', '12345678', 'Duplicate User');
        } catch (e) {
          setError(e.message);
        }
      };

      return (
        <>
          <button onClick={handleClick}>signup</button>
          {error && <span>{error}</span>}
        </>
      );
    }

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: /signup/i }));

    await waitFor(() => {
      expect(screen.getByText('El correo duplicate@example.com ya tiene una cuenta asociada.')).toBeInTheDocument();
    });
  });

  it('returns a clear duplicate-email message from signup', async () => {
    const usersCollection = createUsersCollection();
    usersCollection.getFullList = vi.fn(async () => [{ email: 'taken@example.com' }]);
    mockPb.collection.mockImplementation((name) => {
      if (name === 'users') return usersCollection;
      return {
        getList: vi.fn(async () => ({ items: [] })),
        create: vi.fn(async (payload) => ({ id: 'record-1', ...payload })),
        update: vi.fn(async (id, payload) => ({ id, ...payload })),
      };
    });

    function AuthProbe() {
      const { signup } = useAuth();
      const [error, setError] = React.useState('');

      const handleClick = async () => {
        try {
          await signup('taken@example.com', '12345678', '12345678', 'Taken User');
        } catch (e) {
          setError(e.message);
        }
      };

      return (
        <>
          <button onClick={handleClick}>signup</button>
          {error && <span>{error}</span>}
        </>
      );
    }

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: /signup/i }));

    await waitFor(() => {
      expect(screen.getByText('El correo taken@example.com ya tiene una cuenta asociada.')).toBeInTheDocument();
    });
  });
});
