import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const mod = { exports: {} };
vm.runInNewContext(readFileSync(resolve(process.cwd(), '../pocketbase/pb_hooks/irrigation-policy.js'), 'utf8'), { module: mod, exports: mod.exports });
const { decide, cycleFromLogs } = mod.exports;

const MIN = 60000;
const input = {
  humidity: 50, humidityMin: 65, humidityMax: 80, waterLevel: 80, currentState: 'OFF', nowMs: 10 * 60 * MIN,
  activeSinceMs: NaN, lastStoppedAtMs: NaN, maxContinuousMs: 60 * MIN, minRestMs: 0,
  pulseOnMs: 10 * MIN, pulseOffMs: 20 * MIN, inPulseCycle: false, cycleOnMs: 0,
};

describe('riego por pulsos', () => {
  it('sin pulsos configurados se comporta como antes', () => {
    const base = { ...input, pulseOnMs: 0, pulseOffMs: 0 };
    expect(decide({ ...base })).toEqual({ state: 'ON', reason: 'humidity_low' });
    expect(decide({ ...base, currentState: 'ON', activeSinceMs: input.nowMs - 30 * MIN, humidity: 70 })).toEqual({ state: 'ON', reason: 'hysteresis_hold' });
  });
  it('pausa al terminar el pulso', () => {
    expect(decide({ ...input, currentState: 'ON', humidity: 70, activeSinceMs: input.nowMs - 10 * MIN })).toEqual({ state: 'OFF', reason: 'pulse_pause', pulse: 'pause' });
    expect(decide({ ...input, currentState: 'ON', humidity: 70, activeSinceMs: input.nowMs - 5 * MIN }).state).toBe('ON');
  });
  it('espera la pausa y luego reanuda mientras no llegue al máximo', () => {
    const paused = { ...input, humidity: 70, inPulseCycle: true, cycleOnMs: 10 * MIN };
    expect(decide({ ...paused, lastStoppedAtMs: input.nowMs - 5 * MIN })).toEqual({ state: 'OFF', reason: 'pulse_pause' });
    expect(decide({ ...paused, lastStoppedAtMs: input.nowMs - 20 * MIN })).toEqual({ state: 'ON', reason: 'pulse_resume', pulse: 'resume' });
  });
  it('termina el ciclo al llegar a la humedad máxima', () => {
    expect(decide({ ...input, humidity: 82, inPulseCycle: true, cycleOnMs: 10 * MIN, lastStoppedAtMs: input.nowMs - 30 * MIN }))
      .toEqual({ state: 'OFF', reason: 'humidity_recovered', endCycle: true });
  });
  it('el máximo cuenta todo el ciclo, no solo un pulso', () => {
    expect(decide({ ...input, humidity: 70, inPulseCycle: true, cycleOnMs: 60 * MIN, lastStoppedAtMs: input.nowMs - 30 * MIN }))
      .toEqual({ state: 'OFF', reason: 'maximum_runtime', endCycle: true });
    expect(decide({ ...input, currentState: 'ON', humidity: 70, cycleOnMs: 55 * MIN, activeSinceMs: input.nowMs - 6 * MIN }).reason).toBe('maximum_runtime');
  });
  it('reconstruye el ciclo desde los registros', () => {
    const L = (status, source, minute) => ({ status, source, createdMs: minute * MIN });
    // pausa tras el 2.º pulso: ON(THRESHOLD)@0, OFF(PULSE)@10, ON(PULSE)@30, OFF(PULSE)@40
    expect(cycleFromLogs([L('OFF', 'PULSE', 40), L('ON', 'PULSE', 30), L('OFF', 'PULSE', 10), L('ON', 'THRESHOLD', 0)])).toEqual({ inPulseCycle: true, cycleOnMs: 20 * MIN });
    // en pleno 2.º pulso
    expect(cycleFromLogs([L('ON', 'PULSE', 30), L('OFF', 'PULSE', 10), L('ON', 'THRESHOLD', 0)])).toEqual({ inPulseCycle: false, cycleOnMs: 10 * MIN });
    // primer pulso, o ciclo cerrado por humedad
    expect(cycleFromLogs([L('ON', 'THRESHOLD', 0)])).toEqual({ inPulseCycle: false, cycleOnMs: 0 });
    expect(cycleFromLogs([L('OFF', 'THRESHOLD', 50), L('OFF', 'PULSE', 40), L('ON', 'PULSE', 30)])).toEqual({ inPulseCycle: false, cycleOnMs: 0 });
    expect(cycleFromLogs([])).toEqual({ inPulseCycle: false, cycleOnMs: 0 });
  });
});
