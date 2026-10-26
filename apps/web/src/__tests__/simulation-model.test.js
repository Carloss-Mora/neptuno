import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const load = (file) => {
  const moduleRef = { exports: {} };
  const source = readFileSync(resolve(process.cwd(), '../pocketbase/pb_hooks', file), 'utf8');
  vm.runInNewContext(source, { module: moduleRef, exports: moduleRef.exports });
  return moduleRef.exports;
};

const model = load('simulation-model.js');
const policy = load('irrigation-policy.js');

describe('soil physics of the simulation lab', () => {
  it('lowers humidity while idle and raises it while irrigating', () => {
    expect(model.physics({ humidity: 50, waterLevel: 80, irrigating: false, fault: 'none', stepMinutes: 10 }).humidity).toBe(45);
    const watering = model.physics({ humidity: 50, waterLevel: 80, irrigating: true, fault: 'none', stepMinutes: 10 });
    expect(watering.humidity).toBe(65);
    expect(watering.waterLevel).toBe(76);
  });

  it('keeps humidity inside 0-100 and never goes below an empty tank', () => {
    expect(model.physics({ humidity: 98, waterLevel: 1, irrigating: true, fault: 'none', stepMinutes: 60 })).toEqual({ humidity: 100, waterLevel: 0 });
    expect(model.physics({ humidity: 2, waterLevel: 50, irrigating: false, fault: 'none', stepMinutes: 60 }).humidity).toBe(0);
  });

  it('does not raise humidity when the irrigation has no effect or the tank is empty', () => {
    expect(model.physics({ humidity: 40, waterLevel: 80, irrigating: true, fault: 'no_response', stepMinutes: 10 }).humidity).toBe(40);
    expect(model.physics({ humidity: 40, waterLevel: 0, irrigating: true, fault: 'none', stepMinutes: 10 }).humidity).toBe(40);
  });

  it('validates readings like the ingest endpoint', () => {
    expect(model.isValidReading({ soilHumidity: 50, temperature: 20, waterLevel: 70 })).toBe(true);
    expect(model.isValidReading({ soilHumidity: 150, temperature: 20, waterLevel: 70 })).toBe(false);
    expect(model.isValidReading({ soilHumidity: NaN, temperature: 20, waterLevel: 70 })).toBe(false);
  });
});

describe('simulated cycle through the real decision policy', () => {
  const config = { humidityMin: 30, humidityMax: 60, maxContinuousMs: 60 * 60000, minRestMs: 0, manualOverrideUntilMs: 0 };

  it('starts below the minimum, holds, and stops at the maximum', () => {
    let state = 'OFF';
    let humidity = 20;
    let nowMs = 0;
    let activeSinceMs = NaN;
    const states = [];
    for (let step = 0; step < 14; step += 1) {
      nowMs += 5 * 60000;
      humidity = model.physics({ humidity, waterLevel: 80, irrigating: state === 'ON', fault: 'none', stepMinutes: 5 }).humidity;
      const decision = policy.decide({ ...config, humidity, waterLevel: 80, currentState: state, nowMs, activeSinceMs, lastStoppedAtMs: NaN });
      if (decision.state === 'ON' && state === 'OFF') activeSinceMs = nowMs;
      state = decision.state;
      states.push(`${state}:${decision.reason}`);
    }
    expect(states[0]).toBe('ON:humidity_low');
    expect(states).toContain('OFF:humidity_recovered');
    expect(states.slice(1, 5).every((value) => value === 'ON:hysteresis_hold')).toBe(true);
  });

  it('stops by maximum runtime when irrigation has no effect', () => {
    let state = 'ON';
    const activeSinceMs = 0;
    const decision = policy.decide({ ...config, humidity: 20, waterLevel: 80, currentState: state, nowMs: 61 * 60000, activeSinceMs, lastStoppedAtMs: NaN });
    state = decision.state;
    expect(decision).toEqual({ state: 'OFF', reason: 'maximum_runtime' });
  });
});
