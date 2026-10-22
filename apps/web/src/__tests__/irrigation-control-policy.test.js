import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const policyModule = { exports: {} };
const policySource = readFileSync(resolve(process.cwd(), '../pocketbase/pb_hooks/irrigation-policy.js'), 'utf8');
vm.runInNewContext(policySource, { module: policyModule, exports: policyModule.exports });
const { decide } = policyModule.exports;

const policyInput = {
  humidity: 20,
  humidityMin: 30,
  humidityMax: 60,
  waterLevel: 80,
  currentState: 'OFF',
  nowMs: 100000,
  activeSinceMs: Number.NaN,
  lastStoppedAtMs: Number.NaN,
  maxContinuousMs: 3600000,
  minRestMs: 60000,
};

describe('server irrigation control policy', () => {
  it('starts only below the minimum humidity threshold', () => {
    expect(decide(policyInput)).toEqual({ state: 'ON', reason: 'humidity_low' });
    expect(decide({ ...policyInput, humidity: 30 })).toEqual({ state: 'OFF', reason: 'humidity_sufficient' });
  });

  it('uses the upper threshold to stop irrigation with hysteresis', () => {
    expect(decide({ ...policyInput, currentState: 'ON', humidity: 59 })).toEqual({
      state: 'ON',
      reason: 'hysteresis_hold',
    });
    expect(decide({ ...policyInput, currentState: 'ON', humidity: 60 })).toEqual({
      state: 'OFF',
      reason: 'humidity_recovered',
    });
  });

  it('blocks irrigation with low water and enforces maximum runtime and minimum rest', () => {
    expect(decide({ ...policyInput, waterLevel: 19 })).toEqual({ state: 'OFF', reason: 'low_water' });
    expect(decide({ ...policyInput, currentState: 'ON', activeSinceMs: 0, maxContinuousMs: 60000, humidity: 20 })).toEqual({
      state: 'OFF',
      reason: 'maximum_runtime',
    });
    expect(decide({ ...policyInput, lastStoppedAtMs: 99000 })).toEqual({ state: 'OFF', reason: 'minimum_rest' });
  });

  it('keeps the current state when required safety settings are missing', () => {
    expect(decide({ ...policyInput, currentState: 'ON', humidityMax: Number.NaN })).toEqual({
      state: 'OFF',
      reason: 'configuration_missing',
    });
  });

  it('holds the current state while a manual override is active', () => {
    expect(decide({ ...policyInput, currentState: 'OFF', manualOverrideUntilMs: 100001 })).toEqual({
      state: 'OFF',
      reason: 'manual_override',
    });
    expect(decide({ ...policyInput, currentState: 'ON', manualOverrideUntilMs: 100001 })).toEqual({
      state: 'ON',
      reason: 'manual_override',
    });
    expect(decide({ ...policyInput, currentState: 'OFF', manualOverrideUntilMs: 99999 })).toEqual({
      state: 'ON',
      reason: 'humidity_low',
    });
  });
});
