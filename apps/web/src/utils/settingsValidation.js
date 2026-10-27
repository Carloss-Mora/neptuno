// Devuelve el primer problema de los valores por defecto (o '' si están bien).
export const validateDefaults = (draft) => {
  const has = (value) => value !== '' && value !== null && value !== undefined;
  const number = (value) => Number(value);
  const between = (value, min, max) => Number.isFinite(number(value)) && number(value) >= min && number(value) <= max;
  if (has(draft.default_humidity_min) !== has(draft.default_humidity_max)) return 'Define la humedad mínima y la máxima, o deja las dos vacías.';
  if (has(draft.default_humidity_min)) {
    if (!between(draft.default_humidity_min, 1, 100) || !between(draft.default_humidity_max, 1, 100)) return 'La humedad debe estar entre 1 y 100 %.';
    if (number(draft.default_humidity_min) >= number(draft.default_humidity_max)) return 'La humedad mínima debe ser menor que la máxima.';
  }
  if (has(draft.default_max_irrigation_minutes) && !between(draft.default_max_irrigation_minutes, 1, 1440)) return 'El riego continuo máximo debe estar entre 1 y 1440 minutos.';
  if (has(draft.default_min_rest_minutes) && !between(draft.default_min_rest_minutes, 0, 10080)) return 'El descanso mínimo debe estar entre 0 y 10080 minutos.';
  if (has(draft.default_flow_lpm) && !(number(draft.default_flow_lpm) > 0 && number(draft.default_flow_lpm) <= 100000)) return 'El caudal debe ser mayor que 0.';
  return '';
};

