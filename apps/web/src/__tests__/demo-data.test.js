import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const sandbox = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../../pocketbase/pb_hooks/demo-data.js'), 'utf8'), sandbox);
const demo = sandbox.module.exports;

const run = (zones, days = 30) => {
  const end = Date.UTC(2026, 9, 26, 12, 0);
  const params = demo.paramsFromCrop({ humidity_min: 65, humidity_max: 80, max_irrigation_minutes: 20, min_rest_minutes: 120, flow_lpm: 10 });
  const state = demo.newState(end - days * 86400000, zones, 11);
  const events = [];
  demo.advance(state, params, end, (event) => events.push(event));
  return { events, params, state };
};

describe('datos de ejemplo', () => {
  it('genera lecturas cada 20 minutos dentro de rangos creíbles', () => {
    const { events } = run(1);
    const readings = events.filter((e) => e.type === 'reading');
    expect(readings.length).toBeGreaterThan(30 * 24 * 3 - 5);
    expect(Math.min(...readings.map((r) => r.humidity))).toBeGreaterThan(50);
    expect(Math.max(...readings.map((r) => r.humidity))).toBeLessThan(96);
    expect(Math.min(...readings.map((r) => r.temperature))).toBeGreaterThan(8);
    expect(Math.max(...readings.map((r) => r.temperature))).toBeLessThan(26);
    expect(Math.min(...readings.map((r) => r.water))).toBeGreaterThan(20);
  });
  it('riega pocas veces al día y cada ON tiene su OFF', () => {
    const { events } = run(1);
    const logs = events.filter((e) => e.type === 'log');
    expect(logs.length).toBeGreaterThan(20);
    expect(logs.length).toBeLessThan(30 * 2 * 4);
    logs.forEach((log, i) => expect(log.status).toBe(i % 2 === 0 ? 'ON' : 'OFF'));
  });
  it('con zonas genera registros por zona y del cultivo completo', () => {
    const { events } = run(2, 10);
    const zoneLogs = events.filter((e) => e.type === 'log' && e.zone !== null);
    const cropLogs = events.filter((e) => e.type === 'log' && e.zone === null);
    expect(zoneLogs.length).toBeGreaterThan(0);
    expect(cropLogs.length).toBeGreaterThan(0);
    expect(events.find((e) => e.type === 'reading').zoneHumidity).toHaveLength(2);
  });
  it('es repetible con la misma semilla', () => {
    expect(JSON.stringify(run(1, 3).events)).toBe(JSON.stringify(run(1, 3).events));
  });
});
