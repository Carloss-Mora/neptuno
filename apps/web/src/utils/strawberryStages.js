// Valores iniciales de riego por etapa fenológica de la fresa (Fragaria × ananassa).
//
// Qué respalda cada valor:
// - Tiempo de riego por evento: LSU AgCenter (goteo en fresa): ~20 min en plantas en
//   crecimiento, ~25-30 min al inicio de cosecha y hasta 30-70 min en plena cosecha.
// - Descanso entre riegos: la raíz es superficial, por eso se riega poco y seguido
//   (SIOC / Cámara de Comercio, estudio del cultivo de la fresa en Colombia).
// - Temperatura: día 18-25 °C y noche 8-13 °C; el calor favorece lo vegetativo y daña
//   la floración y el cuajado por encima de ~30 °C.
// - Humedad: la literatura (Irrigation Science; UC ANR) la expresa en tensión del suelo,
//   no en %: óptimo cerca de -10 kPa (capacidad de campo) y riego entre -15 y -30 kPa.
//   Los % de abajo son un punto de partida y deben calibrarse con TU sensor y TU suelo.
export const STRAWBERRY_STAGE_DEFAULTS = {
  vegetativo: {
    humidity_min: 65,
    humidity_max: 80,
    max_irrigation_minutes: 20,
    min_rest_minutes: 240,
    alert_water_min: 20,
    alert_temp_max: 30,
    note: 'Raíz en desarrollo y superficial: riegos cortos y frecuentes, suelo húmedo sin encharcar.',
  },
  floración: {
    humidity_min: 60,
    humidity_max: 75,
    max_irrigation_minutes: 20,
    min_rest_minutes: 180,
    alert_water_min: 20,
    alert_temp_max: 28,
    note: 'Humedad moderada y estable; el calor y el exceso de agua afectan la floración y el cuajado.',
  },
  fructificación: {
    humidity_min: 70,
    humidity_max: 85,
    max_irrigation_minutes: 30,
    min_rest_minutes: 120,
    alert_water_min: 25,
    alert_temp_max: 30,
    note: 'Es la etapa de mayor demanda de agua: evita que el suelo se seque durante el llenado y la cosecha.',
  },
};

export const STAGE_FIELDS = ['humidity_min', 'humidity_max', 'max_irrigation_minutes', 'min_rest_minutes', 'alert_water_min', 'alert_temp_max'];

export function stagePreset(stage) {
  const preset = STRAWBERRY_STAGE_DEFAULTS[stage];
  if (!preset) return null;
  return STAGE_FIELDS.reduce((acc, key) => ({ ...acc, [key]: String(preset[key]) }), {});
}

// Aplica los valores de la etapa nueva. Un campo se sobrescribe solo si está vacío o si
// aún tiene el valor sugerido de la etapa anterior; lo que la persona escribió se respeta,
// salvo que force=true. Devuelve { values, kept } (kept = campos personalizados que se conservaron).
export function applyStageDefaults(form, nextStage, { force = false } = {}) {
  const next = stagePreset(nextStage);
  if (!next) return { values: {}, kept: [] };
  const previous = stagePreset(form.phenological_stage) || {};
  const values = {};
  const kept = [];
  for (const key of STAGE_FIELDS) {
    const current = String(form[key] ?? '').trim();
    if (force || current === '' || current === previous[key]) values[key] = next[key];
    else if (current !== next[key]) kept.push(key);
  }
  return { values, kept };
}
