import { isSet } from '@/utils/optionalNumber';

// Margen (puntos de %) por debajo del mínimo a partir del cual el suelo se considera "muy seco".
export const VERY_DRY_MARGIN = 10;

export const SOIL_STATES = {
  very_dry: { label: 'Muy seco', tone: 'rose' },
  dry: { label: 'Seco', tone: 'amber' },
  ok: { label: 'Húmedo y estable', tone: 'emerald' },
  wet: { label: 'Mucha agua', tone: 'sky' },
};

// Clasifica la humedad con los umbrales del cultivo (los de la etapa o los que la persona ajustó).
// Devuelve null si falta la lectura o los umbrales: sin umbrales no se inventa un estado.
export function soilState(value, crop) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (!isSet(crop?.humidity_min) || !isSet(crop?.humidity_max)) return null;
  const min = Number(crop.humidity_min);
  const max = Number(crop.humidity_max);
  if (n < min - VERY_DRY_MARGIN) return { key: 'very_dry', ...SOIL_STATES.very_dry };
  if (n < min) return { key: 'dry', ...SOIL_STATES.dry };
  if (n > max) return { key: 'wet', ...SOIL_STATES.wet };
  return { key: 'ok', ...SOIL_STATES.ok };
}

export const SOIL_TONE_CLASSES = {
  rose: 'bg-rose-100 text-rose-800',
  amber: 'bg-amber-100 text-amber-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  sky: 'bg-sky-100 text-sky-800',
};
