import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SensorsPage from '@/pages/SensorsPage';
import ReportsPage from '@/pages/ReportsPage';

const mockPb = vi.hoisted(() => ({ collection: vi.fn(), send: vi.fn() }));
vi.mock('@/lib/pocketbaseClient', () => ({ default: mockPb, pocketbaseClient: mockPb }));
vi.mock('@/components/Header', () => ({ default: () => <header /> }));
vi.mock('@/components/WaterConsumptionChart', () => ({ default: ({ hasFlow }) => <div data-testid="chart">{hasFlow ? 'litros' : 'minutos'}</div> }));
const mockExport = vi.hoisted(() => ({ downloadPdf: vi.fn(async () => {}), downloadExcel: vi.fn(async () => {}) }));
vi.mock('@/utils/reportExport', async (importOriginal) => ({ ...(await importOriginal()), ...mockExport }));

const crop = vi.hoisted(() => ({ id: 'c1', name: 'Lote 1', humidity_min: 30, alert_water_min: 20, flow_lpm: 10, area_m2: 100, layout_rows: 2, layout_cols: 2 }));
const cropContext = vi.hoisted(() => ({ selectedCrop: null, refreshCrops: vi.fn(async () => []) }));
vi.mock('@/contexts/CropContext', () => ({ useCrop: () => cropContext }));
const mockUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser }) }));

const recent = () => new Date(Date.now() - 5000).toISOString();
const sensorsList = () => [
  { id: 's1', name: 'Humedad norte', kind: 'soil_humidity', grid_row: 0, grid_col: 0, last_value: 45, last_reading_at: recent() },
  { id: 's2', name: 'Humedad sur', kind: 'soil_humidity', grid_row: 0, grid_col: 1, last_value: 20, last_reading_at: recent() },
  { id: 's3', name: 'Tanque', kind: 'water_level', grid_row: 1, grid_col: 0 },
];

const setupPb = ({ sensors = sensorsList(), create, hours = [] } = {}) => {
  mockPb.send.mockResolvedValue({ hours });
  mockPb.collection.mockImplementation((name) => ({
    getFullList: vi.fn(async () => (name === 'sensors' ? sensors : [])),
    create: create || vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }));
};

describe('Sensors page', () => {
  beforeEach(() => { vi.clearAllMocks(); cropContext.selectedCrop = crop; });

  it('draws each sensor in its cell with its own state', async () => {
    setupPb();
    render(<MemoryRouter><SensorsPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /Fila 1, columna 1: Humedad norte, 45 %, Normal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fila 1, columna 2: Humedad sur, 20 %, Alerta/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fila 2, columna 1: Tanque, --, Sin lecturas/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar sensor en fila 2, columna 2' })).toBeInTheDocument();
    const summary = screen.getByLabelText('Resumen');
    expect(within(summary).getByText('En alerta').nextSibling).toHaveTextContent('1');
  });

  it('creates a sensor in the chosen free cell', async () => {
    const create = vi.fn(async () => ({ id: 'new' }));
    setupPb({ create });
    render(<MemoryRouter><SensorsPage /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar sensor en fila 2, columna 2' }));
    await userEvent.type(screen.getByLabelText('Nombre'), 'Temperatura sur');
    await userEvent.selectOptions(screen.getByLabelText('Qué mide'), 'temperature');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sensor' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ userId: 'u1', cropId: 'c1', name: 'Temperatura sur', kind: 'temperature', grid_row: 1, grid_col: 1 }, expect.anything()));
  });

  it('asks for a name before saving', async () => {
    const create = vi.fn();
    setupPb({ create });
    render(<MemoryRouter><SensorsPage /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar sensor en fila 2, columna 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sensor' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ponle un nombre');
    expect(create).not.toHaveBeenCalled();
  });

  it('invites to create a crop first when there is none', async () => {
    cropContext.selectedCrop = null;
    setupPb();
    render(<MemoryRouter><SensorsPage /></MemoryRouter>);
    expect(await screen.findByText('Primero crea un cultivo')).toBeInTheDocument();
  });
});

describe('Reports page', () => {
  beforeEach(() => { vi.clearAllMocks(); cropContext.selectedCrop = crop; });

  it('shows the period summary and downloads both formats', async () => {
    setupPb({ hours: [{ hour: '2026-10-20T13:00:00.000Z', humidity: 40, temperature: 21, water_level: 70, samples: 4 }] });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    expect(await screen.findByTestId('chart')).toHaveTextContent('litros');
    expect(screen.getByText('Consumo estimado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await waitFor(() => expect(mockExport.downloadPdf).toHaveBeenCalled());
    expect(mockExport.downloadPdf.mock.calls[0][0]).toMatchObject({ cropName: 'Lote 1', days: 30 });
    await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    await waitFor(() => expect(mockExport.downloadExcel).toHaveBeenCalled());
  });

  it('explains the missing flow rate and falls back to minutes', async () => {
    cropContext.selectedCrop = { ...crop, flow_lpm: 0 };
    setupPb();
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    expect(await screen.findByText(/falta el caudal/)).toBeInTheDocument();
    expect(screen.getByTestId('chart')).toHaveTextContent('minutos');
  });

  it('validates a custom period before allowing downloads', async () => {
    setupPb();
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: 'Elegir fechas' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Elige la fecha de inicio y la de fin.');
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Desde'), '2026-10-20');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-10');
    expect(screen.getByRole('alert')).toHaveTextContent('anterior a la de fin');
  });

  it('surfaces a load error with a retry button', async () => {
    mockPb.send.mockRejectedValue(Object.assign(new Error('x'), { status: 0 }));
    mockPb.collection.mockImplementation(() => ({ getFullList: vi.fn(async () => []) }));
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los datos del reporte.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
