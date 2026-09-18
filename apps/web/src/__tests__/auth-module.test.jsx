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
  create: vi.fn(async (payload) => ({
    id: 'user-1',
    ...payload,
  })),
  getFullList: vi.fn(async () => []),
  getList: vi.fn(async () => ({ items: [] })),
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

  it('creates the user account and logs them in', async () => {
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
      expect(screen.getByText('authenticated')).toBeInTheDocument();
      expect(screen.getByText('new@example.com')).toBeInTheDocument();
    });
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
