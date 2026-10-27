import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '@/pages/SettingsPage';
import { UserSettingsProvider } from '@/contexts/UserSettingsContext';
import { validateDefaults } from '@/utils/settingsValidation';

const mockPb = vi.hoisted(() => ({ collection: vi.fn(), send: vi.fn(), authStore: { isValid: true, model: { id: 'u1' }, clear: vi.fn() } }));
vi.mock('@/lib/pocketbaseClient', () => ({ default: mockPb, pocketbaseClient: mockPb }));
vi.mock('@/components/Header', () => ({ default: () => <header /> }));
const mockUser = vi.hoisted(() => ({ id: 'u1', name: 'Carlos', email: 'c@example.com' }));
const mockAuth = vi.hoisted(() => ({ updateProfile: vi.fn(), deleteAccount: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser, ...mockAuth }) }));

const renderPage = () => render(<MemoryRouter><UserSettingsProvider><SettingsPage /></UserSettingsProvider></MemoryRouter>);

describe('Settings page', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows the load error and recovers with Reintentar', async () => {
    const getList = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 400 }))
      .mockResolvedValueOnce({ items: [{ id: 'r1', notify_irrigation_events: true, notify_alerts: false, unit_volume: 'gal' }] });
    mockPb.collection.mockReturnValue({ getList });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar tus ajustes.');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    const [irrigation, alerts] = screen.getAllByRole('checkbox');
    expect(irrigation).toBeChecked();
    expect(alerts).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Galones (gal)' })).toHaveAttribute('aria-checked', 'true');
  });

  it('renders defaults when the user has no settings row yet', async () => {
    mockPb.collection.mockReturnValue({ getList: vi.fn(async () => ({ items: [] })) });
    renderPage();
    await waitFor(() => expect(screen.getAllByRole('checkbox')[1]).toBeChecked());
    expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Litros (L)' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Todo está guardado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });

  it('saves units, defaults and the name together, sending 0 for empty numbers', async () => {
    const create = vi.fn(async (payload) => ({ id: 'new1', ...payload }));
    mockPb.collection.mockReturnValue({ getList: vi.fn(async () => ({ items: [] })), create });
    mockAuth.updateProfile.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getAllByRole('checkbox')[1]).toBeChecked());
    await userEvent.click(screen.getByRole('radio', { name: 'Galones (gal)' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Fahrenheit (°F)' }));
    await userEvent.type(screen.getByLabelText('Caudal (L/min)'), '12');
    const name = screen.getByLabelText('Nombre');
    await userEvent.clear(name);
    await userEvent.type(name, 'Carlos Mora');
    expect(screen.getByText('Tienes cambios sin guardar.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ userId: 'u1', unit_volume: 'gal', unit_temp: 'F', default_flow_lpm: 12, default_humidity_min: 0, retention_days: 30 });
    expect(mockAuth.updateProfile).toHaveBeenCalledWith({ name: 'Carlos Mora' });
    expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados.');
  });

  it('refuses invalid defaults without calling the server', async () => {
    const create = vi.fn();
    mockPb.collection.mockReturnValue({ getList: vi.fn(async () => ({ items: [] })), create });
    renderPage();
    await waitFor(() => expect(screen.getAllByRole('checkbox')[1]).toBeChecked());
    await userEvent.type(screen.getByLabelText('Humedad mínima (%)'), '70');
    await userEvent.type(screen.getByLabelText('Humedad máxima (%)'), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La humedad mínima debe ser menor que la máxima.');
    expect(create).not.toHaveBeenCalled();
  });

  it('only enables account deletion after typing ELIMINAR', async () => {
    mockPb.collection.mockReturnValue({ getList: vi.fn(async () => ({ items: [] })) });
    mockAuth.deleteAccount.mockResolvedValue();
    renderPage();
    const button = await screen.findByRole('button', { name: 'Eliminar cuenta' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Escribe ELIMINAR para confirmar'), 'eliminar');
    expect(button).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Escribe ELIMINAR para confirmar'));
    await userEvent.type(screen.getByLabelText('Escribe ELIMINAR para confirmar'), 'ELIMINAR');
    expect(button).toBeEnabled();
    await userEvent.click(button);
    await waitFor(() => expect(mockAuth.deleteAccount).toHaveBeenCalled());
  });
});

describe('validateDefaults', () => {
  it('accepts empty values and valid pairs', () => {
    expect(validateDefaults({})).toBe('');
    expect(validateDefaults({ default_humidity_min: 40, default_humidity_max: 70, default_max_irrigation_minutes: 30, default_flow_lpm: 5 })).toBe('');
  });
  it('rejects incomplete or out-of-range values', () => {
    expect(validateDefaults({ default_humidity_min: 40 })).toMatch(/mínima y la máxima/);
    expect(validateDefaults({ default_humidity_min: 0, default_humidity_max: 120 })).toMatch(/entre 1 y 100/);
    expect(validateDefaults({ default_max_irrigation_minutes: 5000 })).toMatch(/1440/);
    expect(validateDefaults({ default_flow_lpm: -3 })).toMatch(/mayor que 0/);
  });
});
