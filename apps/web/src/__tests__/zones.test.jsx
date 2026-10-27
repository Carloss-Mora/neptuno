import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildIrrigationSessions, estimateDailyConsumption } from '@/utils/irrigationMetrics';
import { buildReport } from '@/utils/reportData';
import { zoneFlowMap, zoneFlowTotal } from '@/hooks/useZones';

const create = vi.fn(async (data) => ({ id: 'new', ...data }));
vi.mock('@/lib/pocketbaseClient', () => ({
  default: { collection: () => ({ getList: async () => ({ items: [{ zoneId: 'z1', status: 'ON' }, { zoneId: 'z2', status: 'OFF' }] }), create: (...args) => create(...args), update: vi.fn(), delete: vi.fn() }) },
}));

import ZonesCard, { zoneStates } from '@/components/ZonesCard';

const log = (id, zoneId, status, iso) => ({ id, zoneId, status, source: 'THRESHOLD', created: iso });

describe('zonas: sesiones y consumo', () => {
  const logs = [
    log('a1', '', 'ON', '2026-10-10T06:00:00'), log('a2', '', 'OFF', '2026-10-10T06:30:00'),
    log('b1', 'z1', 'ON', '2026-10-10T06:00:00'), log('b2', 'z1', 'OFF', '2026-10-10T06:20:00'),
    log('c1', 'z2', 'ON', '2026-10-10T06:10:00'), log('c2', 'z2', 'OFF', '2026-10-10T06:30:00'),
  ];
  const flows = new Map([['z1', 6], ['z2', 4]]);
  it('sin zonas usa solo los registros del cultivo', () => {
    expect(buildIrrigationSessions(logs, new Date('2026-10-11')).length).toBe(1);
  });
  it('con zonas cada válvula es un riego con su caudal', () => {
    const sessions = buildIrrigationSessions(logs, new Date('2026-10-11'), flows);
    expect(sessions.map((s) => s.zoneId).sort()).toEqual(['z1', 'z2']);
    const liters = estimateDailyConsumption(sessions, new Date('2026-10-10'), new Date('2026-10-10T23:00:00'), null).get('2026-10-10');
    expect(liters).toBeCloseTo(20 * 6 + 20 * 4, 5);
  });
  it('el reporte suma los litros por zona y nombra la zona', () => {
    const report = buildReport({
      crop: { name: 'A' }, logs, zones: [{ id: 'z1', name: 'Norte' }, { id: 'z2', name: 'Sur' }], zoneFlows: flows,
      from: new Date('2026-10-10T00:00:00'), to: new Date('2026-10-10T23:59:59'), now: new Date('2026-10-11'),
    });
    expect(report.totals.liters).toBeCloseTo(200, 5);
    expect(report.sessions.map((s) => s.zone).sort()).toEqual(['Norte', 'Sur']);
    expect(report.flowLpm).toBe(10);
  });
  it('reparte el caudal del cultivo si la zona no tiene el suyo', () => {
    const map = zoneFlowMap([{ id: 'z1', flow_lpm: 0 }, { id: 'z2', flow_lpm: 0 }], { flow_lpm: 10 });
    expect(map.get('z1')).toBe(5);
    expect(zoneFlowTotal(map)).toBe(10);
  });
  it('el estado de cada zona sale de su último registro', () => {
    expect(zoneStates([{ zoneId: 'z1', status: 'ON' }, { zoneId: 'z1', status: 'OFF' }, { zoneId: 'z2', status: 'OFF' }]).get('z1')).toBe(true);
  });
});

describe('ZonesCard', () => {
  const crop = { id: 'c1' };
  it('valida y crea una zona', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    render(<ZonesCard crop={crop} userId="u1" zones={[{ id: 'z1', name: 'Norte', valve_channel: 1, flow_lpm: 6 }]} reload={reload} sensors={[{ zoneId: 'z1' }]} />);
    expect(screen.getByText('Norte')).toBeInTheDocument();
    expect(await screen.findByText('Regando')).toBeInTheDocument();
    expect(screen.getByText(/Válvula 1 · 6 L\/min · 1 sensor/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Agregar zona/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar zona' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ponle un nombre');
    await user.type(screen.getByLabelText('Nombre de la zona'), 'Sur');
    expect(screen.getByLabelText(/Canal de la válvula/)).toHaveValue(2);
    await user.clear(screen.getByLabelText(/Canal de la válvula/));
    await user.type(screen.getByLabelText(/Canal de la válvula/), '1');
    await user.click(screen.getByRole('button', { name: 'Guardar zona' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El canal 1 ya lo usa otra zona');
    await user.clear(screen.getByLabelText(/Canal de la válvula/));
    await user.type(screen.getByLabelText(/Canal de la válvula/), '3');
    await user.click(screen.getByRole('button', { name: 'Guardar zona' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sur', valve_channel: 3, cropId: 'c1', userId: 'u1' }), expect.anything()));
    expect(reload).toHaveBeenCalled();
  });
});
