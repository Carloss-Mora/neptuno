import { FAULT_OPTIONS, irrigationLabel, reasonLabel } from '@/utils/simulationLabels';

describe('simulation labels', () => {
  it('describes the engine decisions in Spanish', () => {
    expect(reasonLabel('humidity_low')).toMatch(/inicia el riego/);
    expect(reasonLabel('safe_stop_no_reading')).toMatch(/Parada segura/);
    expect(reasonLabel('')).toBe('Sin decisiones todavía');
    expect(reasonLabel('algo_nuevo')).toBe('algo_nuevo');
  });

  it('shows safety stops differently from a normal OFF', () => {
    expect(irrigationLabel('ON', 'humidity_low')).toEqual({ text: 'Regando', tone: 'on' });
    expect(irrigationLabel('OFF', 'maximum_runtime').tone).toBe('safety');
    expect(irrigationLabel('OFF', 'humidity_sufficient')).toEqual({ text: 'Apagado', tone: 'off' });
    expect(irrigationLabel(undefined, undefined).text).toBe('Sin iniciar');
  });

  it('offers the four faults the engine supports', () => {
    expect(FAULT_OPTIONS.map((option) => option.value)).toEqual(['none', 'sensor_offline', 'invalid_reading', 'no_response']);
  });
});
