import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { AlertProvider, useAlert } from '@/contexts/AlertContext';
import { CropProvider, useCrop } from '@/contexts/CropContext';
import { isProvided, isSet, toFormValue, toNumberOrNull } from '@/utils/optionalNumber';

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

// PocketBase devuelve 0 (no null) en los campos numéricos vacíos.
const emptyCrop = {
  id: 'crop-empty',
  userId: 'user-1',
  name: 'Fresas sin umbrales',
  control_mode: 'MANUAL',
  area_m2: 0,
  flow_lpm: 0,
  humidity_min: 0,
  humidity_max: 0,
  max_irrigation_minutes: 0,
  min_rest_minutes: 0,
  manual_override_minutes: 30,
  alert_water_min: 0,
  alert_temp_max: 0,
};

const reading = { id: 'reading-1', cropId: 'crop-empty', soil_humidity: 60, water_level: 80, temperature: 22 };
let currentCrop = emptyCrop;
const updateCropRecord = vi.fn(async (id, data) => ({ id, ...currentCrop, ...data }));
const sensorListRequests = vi.fn();

const Probe = () => {
  const { selectedCrop, updateCrop } = useCrop();
  const { alerts } = useAlert();
  const [result, setResult] = React.useState('');
  const save = async (changes) => {
    try {
      await updateCrop(selectedCrop.id, { ...selectedCrop, ...changes });
      setResult('ok');
    } catch (error) {
      setResult(error.message);
    }
  };
  return (
    <div>
      <span data-testid="crop">{selectedCrop?.id || 'none'}</span>
      <span data-testid="alert-count">{alerts.length}</span>
      <span data-testid="alert-messages">{alerts.map((alert) => alert.message).join('|')}</span>
      <span data-testid="result">{result}</span>
      <button type="button" onClick={() => save({ area_m2: 50 })}>Guardar área</button>
      <button type="button" onClick={() => save({ humidity_min: -5 })}>Humedad negativa</button>
      <button type="button" onClick={() => save({ humidity_min: 30 })}>Solo mínimo</button>
      <button type="button" onClick={() => save({ control_mode: 'AUTO' })}>Activar AUTO</button>
    </div>
  );
};

const renderProbe = () => render(
  <AuthProvider>
    <CropProvider>
      <AlertProvider>
        <Probe />
      </AlertProvider>
    </CropProvider>
  </AuthProvider>,
);

beforeEach(() => {
  currentCrop = emptyCrop;
  updateCropRecord.mockClear();
  sensorListRequests.mockClear();
  localStorage.clear();
  mockPb.collection.mockImplementation((name) => ({
    getFullList: vi.fn(async () => {
      if (name === 'crops') return [currentCrop];
      if (name === 'devices') {
        return [{ id: 'device-1', cropId: currentCrop.id, name: 'ESP', interval_seconds: 15, last_seen: new Date().toISOString() }];
      }
      return [];
    }),
    getList: vi.fn(async () => {
      if (name === 'sensor_readings') {
        sensorListRequests();
        return { items: [reading] };
      }
      return { items: [] };
    }),
    update: updateCropRecord,
    subscribe: vi.fn(async () => vi.fn()),
  }));
});

describe('optional numeric helpers', () => {
  it('treats empty, null and zero as not configured', () => {
    expect(isSet('')).toBe(false);
    expect(isSet(null)).toBe(false);
    expect(isSet(undefined)).toBe(false);
    expect(isSet(0)).toBe(false);
    expect(isSet('0')).toBe(false);
    expect(isSet('abc')).toBe(false);
    expect(isSet(-3)).toBe(false);
    expect(isSet(35)).toBe(true);
    expect(isSet('12.5')).toBe(true);
  });

  it('converts values for forms and for PocketBase payloads', () => {
    expect(isProvided('')).toBe(false);
    expect(isProvided(0)).toBe(true);
    expect(toFormValue(0)).toBe('');
    expect(toFormValue(0, '30')).toBe('30');
    expect(toFormValue(42)).toBe('42');
    expect(toNumberOrNull('0')).toBeNull();
    expect(toNumberOrNull('')).toBeNull();
    expect(toNumberOrNull('18.5')).toBe(18.5);
  });
});

describe('crops whose optional numbers arrive as 0', () => {
  it('does not raise sensor alerts for thresholds that were never configured', async () => {
    renderProbe();
    await waitFor(() => expect(sensorListRequests).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('crop')).toHaveTextContent('crop-empty'));
    expect(screen.getByTestId('alert-count')).toHaveTextContent('0');
    expect(screen.getByTestId('alert-messages').textContent).not.toMatch(/Temperatura/);
  });

  it('raises the temperature alert once a real maximum is configured', async () => {
    currentCrop = { ...emptyCrop, alert_temp_max: 20 };
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('alert-messages')).toHaveTextContent('Temperatura por encima del máximo configurado (20 °C)'));
  });

  it('saves a crop edit that only changes the area, sending null for empty parameters', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('crop')).toHaveTextContent('crop-empty'));
    await act(async () => { screen.getByText('Guardar área').click(); });
    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('ok'));
    const [, payload] = updateCropRecord.mock.calls[0];
    expect(payload).toMatchObject({
      area_m2: 50,
      flow_lpm: null,
      humidity_min: null,
      humidity_max: null,
      max_irrigation_minutes: null,
      alert_water_min: null,
      alert_temp_max: null,
      control_mode: 'MANUAL',
    });
  });

  it('rejects negative thresholds and one-sided humidity limits', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('crop')).toHaveTextContent('crop-empty'));
    await act(async () => { screen.getByText('Humedad negativa').click(); });
    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('La humedad mínima debe ser mayor que 0'));
    await act(async () => { screen.getByText('Solo mínimo').click(); });
    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('Configura ambos umbrales de humedad'));
    expect(updateCropRecord).not.toHaveBeenCalled();
  });

  it('requires thresholds and a maximum runtime before enabling AUTO', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('crop')).toHaveTextContent('crop-empty'));
    await act(async () => { screen.getByText('Activar AUTO').click(); });
    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('Para activar AUTO configura ambos umbrales y el máximo de riego continuo'));
    expect(updateCropRecord).not.toHaveBeenCalled();
  });
});
