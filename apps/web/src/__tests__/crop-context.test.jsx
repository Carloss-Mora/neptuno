import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { CropProvider, useCrop } from '@/contexts/CropContext';
import CropsPage from '@/pages/CropsPage';
import SummaryPage from '@/pages/SummaryPage';

vi.mock('@/components/NotificationBell', () => ({ default: () => null }));

const mockPb = vi.hoisted(() => ({
  authStore: {
    isValid: true,
    model: { id: 'user-1', email: 'grower@example.com' },
    clear: vi.fn(),
  },
  baseURL: 'http://127.0.0.1:8090',
  collection: vi.fn(),
}));

vi.mock('@/lib/pocketbaseClient', () => ({
  default: mockPb,
  pocketbaseClient: mockPb,
}));

const crops = [
  { id: 'crop-north', userId: 'user-1', name: 'Lote norte' },
  { id: 'crop-south', userId: 'user-1', name: 'Lote sur' },
];
let persistedCrops = [];
const summaryListRequests = [];
const getCropList = vi.fn(async () => persistedCrops);
const createCropRecord = vi.fn(async (data) => {
  const crop = { id: `crop-${persistedCrops.length + 1}`, ...data };
  persistedCrops = [...persistedCrops, crop];
  return crop;
});

const CropProbe = () => {
  const { crops: availableCrops, selectedCrop, selectedCropId, selectCrop, createCrop } = useCrop();
  return (
    <div>
      <span data-testid="crop-count">{availableCrops.length}</span>
      <span data-testid="selected-crop">{selectedCropId || 'none'}</span>
      <span data-testid="selected-humidity">
        {selectedCrop ? `${selectedCrop.humidity_min}-${selectedCrop.humidity_max}` : 'none'}
      </span>
      <button type="button" onClick={() => selectCrop('crop-south')}>Seleccionar lote sur</button>
      <button
        type="button"
        onClick={() => createCrop({ name: 'Fresas nuevas', humidity_min: '28', humidity_max: '58' })}
      >
        Crear cultivo
      </button>
    </div>
  );
};

const renderCropProbe = () => render(
  <AuthProvider>
    <CropProvider>
      <CropProbe />
    </CropProvider>
  </AuthProvider>,
);

const renderCropPages = (initialEntry = '/crops') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <AuthProvider>
      <CropProvider>
        <Routes>
          <Route path="/crops" element={<CropsPage />} />
          <Route path="/summary" element={<SummaryPage />} />
        </Routes>
      </CropProvider>
    </AuthProvider>
  </MemoryRouter>,
);

describe('crop selection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    getCropList.mockClear();
    summaryListRequests.length = 0;
    persistedCrops = [...crops];
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = { id: 'user-1', email: 'grower@example.com' };
    mockPb.collection.mockImplementation((name) => {
      if (name === 'crops') return { getFullList: getCropList, create: createCropRecord };
      return {
        getFullList: vi.fn(async (options) => {
          summaryListRequests.push({ name, options });
          return [];
        }),
      };
    });
    createCropRecord.mockClear();
  });

  it('loads the server-scoped crop list and persists the selected crop', async () => {
    const { unmount } = renderCropProbe();

    await waitFor(() => {
      expect(screen.getByTestId('crop-count')).toHaveTextContent('2');
      expect(screen.getByTestId('selected-crop')).toHaveTextContent('crop-north');
    });
    expect(getCropList).toHaveBeenCalledWith({
      sort: 'name',
      $autoCancel: false,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar lote sur' }));
    expect(screen.getByTestId('selected-crop')).toHaveTextContent('crop-south');
    expect(window.localStorage.getItem('neptuno:selected-crop:user-1')).toBe('crop-south');

    unmount();
    renderCropProbe();
    await waitFor(() => expect(screen.getByTestId('selected-crop')).toHaveTextContent('crop-south'));
  });

  it('persists a created crop in PocketBase and reloads its humidity parameters', async () => {
    const { unmount } = renderCropProbe();

    await waitFor(() => expect(screen.getByTestId('crop-count')).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cultivo' }));

    await waitFor(() => {
      expect(createCropRecord).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Fresas nuevas',
        humidity_min: 28,
        humidity_max: 58,
        userId: 'user-1',
      }), { $autoCancel: false });
      expect(screen.getByTestId('crop-count')).toHaveTextContent('3');
    });

    unmount();
    renderCropProbe();
    await waitFor(() => {
      expect(screen.getByTestId('crop-count')).toHaveTextContent('3');
      expect(screen.getByTestId('selected-humidity')).toHaveTextContent('28-58');
    });
  });

  it('shows a save error instead of a success notice when PocketBase rejects creation', async () => {
    createCropRecord.mockRejectedValueOnce(new Error('PocketBase no disponible.'));
    render(
      <MemoryRouter>
        <AuthProvider>
          <CropProvider>
            <CropsPage />
          </CropProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Cultivo sin guardar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cultivo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('PocketBase no disponible.');
    expect(screen.queryByText('Cultivo creado y seleccionado.')).not.toBeInTheDocument();
  });

  it('surfaces PocketBase status and response details for crop load failures in development', async () => {
    const requestError = Object.assign(new Error('Request failed'), {
      status: 403,
      response: { message: 'The request is not allowed.', data: {} },
    });
    getCropList.mockRejectedValueOnce(requestError);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderCropPages();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar los cultivos: HTTP 403 — The request is not allowed.',
    );
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Error al cargar cultivos');
  });

  it('shows a persisted crop in Crops, Summary, and the selector after reloading', async () => {
    persistedCrops = [];
    const { unmount } = renderCropPages();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Fresas del lote sur' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cultivo' }));

    await waitFor(() => {
      expect(screen.getAllByText('Fresas del lote sur').length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText('Cultivo seleccionado')[0]).toHaveTextContent('Fresas del lote sur');
    });
    expect(createCropRecord).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Fresas del lote sur',
      userId: 'user-1',
    }), { $autoCancel: false });
    expect(getCropList).toHaveBeenCalledWith({
      sort: 'name',
      $autoCancel: false,
    });

    const cropCollectionCalls = mockPb.collection.mock.calls.filter(([name]) => name === 'crops').length;
    fireEvent.click(screen.getByRole('link', { name: 'Resumen' }));
    expect(await screen.findByLabelText('Resumen por cultivo')).toHaveTextContent('Fresas del lote sur');
    await waitFor(() => expect(summaryListRequests).toHaveLength(4));
    expect(summaryListRequests.map(({ name, options }) => [name, options.filter])).toEqual([
      ['sensor_readings', undefined],
      ['sensor_readings_hourly', undefined],
      ['irrigation_logs', undefined],
      ['devices', undefined],
    ]);
    expect(screen.getAllByLabelText('Cultivo seleccionado')[0]).toHaveTextContent('Fresas del lote sur');
    expect(mockPb.collection.mock.calls.filter(([name]) => name === 'crops')).toHaveLength(cropCollectionCalls);

    unmount();
    renderCropPages('/summary');
    expect(await screen.findByLabelText('Resumen por cultivo')).toHaveTextContent('Fresas del lote sur');
    expect(screen.getAllByLabelText('Cultivo seleccionado')[0]).toHaveTextContent('Fresas del lote sur');

    fireEvent.click(screen.getByRole('link', { name: 'Cultivos' }));
    expect(within(await screen.findByLabelText('Cultivos registrados')).getByText('Fresas del lote sur')).toBeInTheDocument();
  });
});
