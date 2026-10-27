import { describe, it, expect } from 'vitest';
import { STRAWBERRY_STAGE_DEFAULTS, STAGE_FIELDS, stagePreset, applyStageDefaults } from '@/utils/strawberryStages';

describe('valores por etapa de fresa', () => {
  it('cada etapa es coherente', () => {
    for (const p of Object.values(STRAWBERRY_STAGE_DEFAULTS)) {
      expect(p.humidity_min).toBeLessThan(p.humidity_max);
      expect(p.max_irrigation_minutes).toBeGreaterThan(0);
      expect(p.min_rest_minutes).toBeGreaterThanOrEqual(0);
    }
  });
  it('la fructificación pide más agua que la floración', () => {
    expect(STRAWBERRY_STAGE_DEFAULTS.fructificación.humidity_min).toBeGreaterThan(STRAWBERRY_STAGE_DEFAULTS.floración.humidity_min);
  });
  it('rellena campos vacíos', () => {
    const form = { phenological_stage: '', ...Object.fromEntries(STAGE_FIELDS.map((k) => [k, ''])) };
    expect(applyStageDefaults(form, 'vegetativo').values).toEqual(stagePreset('vegetativo'));
  });
  it('respeta lo escrito por la persona y lo reporta', () => {
    const form = { phenological_stage: 'vegetativo', ...stagePreset('vegetativo'), humidity_min: '50' };
    const { values, kept } = applyStageDefaults(form, 'fructificación');
    expect(kept).toEqual(['humidity_min']);
    expect(values.humidity_min).toBeUndefined();
    expect(values.humidity_max).toBe('85');
  });
  it('force reemplaza todo y etapa vacía no cambia nada', () => {
    const form = { phenological_stage: 'vegetativo', ...stagePreset('vegetativo'), humidity_min: '50' };
    expect(applyStageDefaults(form, 'floración', { force: true }).values.humidity_min).toBe('60');
    expect(applyStageDefaults(form, '').values).toEqual({});
  });
});
