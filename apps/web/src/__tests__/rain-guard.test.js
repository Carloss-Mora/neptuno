import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Los hooks de PocketBase son CommonJS: se cargan en un contexto aislado, como los carga el servidor.
const sandbox = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../../pocketbase/pb_hooks/rain-guard.js'), 'utf8'), sandbox);
const guard = sandbox.module.exports;

const now = Date.UTC(2026, 9, 26, 22, 30);
const cropOf = (fields) => ({ get: (key) => fields[key] });
const base = { rain_skip: true, latitude: 4.45, longitude: -73.8, rain_forecast_mm: 3, rain_forecast_at: new Date(now - 10 * 60000).toISOString() };

describe('rain-guard', () => {
  it('omite el riego si se espera lluvia suficiente', () => {
    expect(guard.shouldSkip(cropOf(base), now)).toBe(true);
  });
  it('no omite si la opción está apagada o falta la ubicación', () => {
    expect(guard.shouldSkip(cropOf({ ...base, rain_skip: false }), now)).toBe(false);
    expect(guard.shouldSkip(cropOf({ ...base, latitude: 0, longitude: 0 }), now)).toBe(false);
  });
  it('respeta el umbral de mm (2 por defecto)', () => {
    expect(guard.shouldSkip(cropOf({ ...base, rain_forecast_mm: 1.5 }), now)).toBe(false);
    expect(guard.shouldSkip(cropOf({ ...base, rain_forecast_mm: 1.5, rain_threshold_mm: 1 }), now)).toBe(true);
  });
  it('ignora un pronóstico viejo', () => {
    expect(guard.shouldSkip(cropOf({ ...base, rain_forecast_at: new Date(now - 3 * 3600000).toISOString() }), now)).toBe(false);
    expect(guard.shouldSkip(cropOf({ ...base, rain_forecast_at: '' }), now)).toBe(false);
  });
  it('si el suelo está muy seco, riega igual', () => {
    expect(guard.shouldSkip(cropOf(base), now, 58, 65)).toBe(true);
    expect(guard.shouldSkip(cropOf(base), now, 50, 65)).toBe(false);
  });
  it('suma las próximas 6 horas', () => {
    const times = ['2026-10-26T21:00', '2026-10-26T22:00', '2026-10-26T23:00', '2026-10-27T03:00', '2026-10-27T04:00'];
    const mm = [9, 1, 0.5, 2, 7];
    expect(guard.sumNextHours(times, mm, now, 6)).toBe(3.5);
    expect(guard.sumNextHours([], [], now, 6)).toBeNull();
  });
});
