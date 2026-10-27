import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const file = path.resolve(__dirname, '../../../../tools/controller-rules.js');
const sandbox = {
  module: { exports: {} },
  __dirname: path.dirname(file),
  require: (name) => ({ 'node:fs': fs, 'node:path': path, 'node:vm': vm })[name],
};
vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox);
const { controllerStep, AUTONOMOUS_MAX_MS } = sandbox.module.exports;

const MIN = 60000;
const config = { control_mode: 'AUTO', humidity_min: 65, humidity_max: 80, max_irrigation_minutes: 60, min_rest_minutes: 0 };
const base = {
  nowMs: 100 * MIN, lastContactMs: 100 * MIN, holdMs: 3 * MIN, config, sensorsOk: true, waterLevel: 80,
  serverZones: [{ channel: 1, state: 'ON' }, { channel: 2, state: 'OFF' }],
  zones: [{ channel: 1, humidity: 70, state: 'ON', activeSinceMs: 95 * MIN }, { channel: 2, humidity: 50, state: 'OFF' }],
};

describe('controlador sin internet', () => {
  it('con contacto reciente obedece al servidor', () => {
    const r = controllerStep({ ...base, lastContactMs: 98 * MIN });
    expect(r.mode).toBe('online');
    expect(r.zones.map((z) => z.state)).toEqual(['ON', 'OFF']);
  });
  it('sin contacto en modo automático sigue regando solo con las reglas del servidor', () => {
    const r = controllerStep({ ...base, lastContactMs: 90 * MIN });
    expect(r.mode).toBe('autonomous');
    expect(r.zones[0].state).toBe('ON'); // 70 %: entre umbrales, sigue
    expect(r.zones[1].state).toBe('ON'); // 50 %: bajo el mínimo, empieza
  });
  it('cierra al llegar a la humedad máxima y respeta el máximo de riego', () => {
    const wet = controllerStep({ ...base, lastContactMs: 90 * MIN, zones: [{ channel: 1, humidity: 82, state: 'ON', activeSinceMs: 95 * MIN }] });
    expect(wet.zones[0]).toMatchObject({ state: 'OFF', reason: 'humidity_recovered' });
    const long = controllerStep({ ...base, lastContactMs: 90 * MIN, zones: [{ channel: 1, humidity: 70, state: 'ON', activeSinceMs: 30 * MIN }] });
    expect(long.zones[0]).toMatchObject({ state: 'OFF', reason: 'maximum_runtime' });
  });
  it('cierra todo si el sensor falla, el agua está baja o el modo no es automático', () => {
    expect(controllerStep({ ...base, lastContactMs: 90 * MIN, sensorsOk: false }).mode).toBe('failsafe');
    expect(controllerStep({ ...base, lastContactMs: 90 * MIN, waterLevel: 10 }).zones.every((z) => z.state === 'OFF')).toBe(true);
    const manual = controllerStep({ ...base, lastContactMs: 90 * MIN, config: { control_mode: 'MANUAL' } });
    expect(manual.mode).toBe('failsafe');
    expect(manual.zones.every((z) => z.state === 'OFF')).toBe(true);
    expect(controllerStep({ ...base, lastContactMs: 90 * MIN, config: null }).mode).toBe('failsafe');
  });
  it('pasado el límite autónomo cierra todo', () => {
    const r = controllerStep({ ...base, nowMs: 100 * MIN + AUTONOMOUS_MAX_MS + 10 * MIN, lastContactMs: 100 * MIN - 5 * MIN });
    expect(r.mode).toBe('failsafe');
  });
  it('los pulsos siguen funcionando sin internet', () => {
    const pulses = { ...config, pulse_on_minutes: 10, pulse_off_minutes: 20 };
    const r = controllerStep({ ...base, lastContactMs: 90 * MIN, config: pulses, zones: [{ channel: 1, humidity: 70, state: 'ON', activeSinceMs: 89 * MIN }] });
    expect(r.zones[0]).toMatchObject({ state: 'OFF', reason: 'pulse_pause', pulse: 'pause' });
  });
});
