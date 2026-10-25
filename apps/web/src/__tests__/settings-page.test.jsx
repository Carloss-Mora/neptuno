import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '@/pages/SettingsPage';

const mockPb = vi.hoisted(() => ({ collection: vi.fn(), authStore: { isValid: true, model: { id: 'u1' }, clear: vi.fn() } }));
vi.mock('@/lib/pocketbaseClient', () => ({ default: mockPb, pocketbaseClient: mockPb }));
vi.mock('@/components/Header', () => ({ default: () => <header /> }));
const mockUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser }) }));

const renderPage = () => render(<MemoryRouter><SettingsPage /></MemoryRouter>);

describe('Settings page', () => {
  it('shows the server error and recovers with Reintentar', async () => {
    const getList = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 400, response: { message: 'Something went wrong.' } }))
      .mockResolvedValueOnce({ items: [{ id: 'r1', notify_irrigation_events: true, notify_alerts: false }] });
    mockPb.collection.mockReturnValue({ getList });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('error 400: Something went wrong.');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    const [irrigation, alerts] = screen.getAllByRole('checkbox');
    expect(irrigation).toBeChecked();
    expect(alerts).not.toBeChecked();
    expect(getList).toHaveBeenLastCalledWith(1, 1, expect.objectContaining({ sort: '-updated' }));
  });

  it('renders defaults when the user has no settings row yet', async () => {
    mockPb.collection.mockReturnValue({ getList: vi.fn(async () => ({ items: [] })) });
    renderPage();
    await waitFor(() => expect(screen.getAllByRole('checkbox')[1]).toBeChecked());
    expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked();
  });
});
