import { describe, it, expect } from 'vitest';
import { soilState } from '@/utils/soilState';
import { startReason, endReason } from '@/utils/irrigationReason';

const crop = { humidity_min: 65, humidity_max: 80 };

describe('estado del suelo', () => {
  it('clasifica con los umbrales del cultivo', () => {
    expect(soilState(40, crop).label).toBe('Muy seco');
    expect(soilState(60, crop).label).toBe('Seco');
    expect(soilState(65, crop).label).toBe('Húmedo y estable');
    expect(soilState(80, crop).label).toBe('Húmedo y estable');
    expect(soilState(90, crop).label).toBe('Mucha agua');
  });
  it('no inventa un estado sin umbrales o sin lectura', () => {
    expect(soilState(50, { humidity_min: 0, humidity_max: 0 })).toBeNull();
    expect(soilState(50, null)).toBeNull();
    expect(soilState(undefined, crop)).toBeNull();
    expect(soilState('', crop)).toBeNull();
  });
});

describe('motivo del riego', () => {
  it('explica inicio y fin', () => {
    expect(startReason('THRESHOLD')).toMatch(/humedad/i);
    expect(startReason('SCHEDULE')).toMatch(/horario/i);
    expect(endReason('WATCHDOG')).toMatch(/seguridad/i);
    expect(endReason(undefined)).toBe('');
  });
});
