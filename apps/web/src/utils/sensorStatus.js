import { isSet } from '@/utils/optionalNumber';

export const SENSOR_KINDS = {
  soil_humidity: { label: 'Humedad del suelo', short: 'Humedad', unit: '%' },
  temperature: { label: 'Temperatura', short: 'Temperatura', unit: '°C' },
  water_level: { label: 'Nivel de agua', short: 'Agua', unit: '%' },
};

export const SENSOR_STATES = {
  ok: { label: 'Normal' },
  alert: { label: 'Alerta' },
  stale: { label: 'Sin señal' },
  never: { label: 'Sin lecturas' },
};

export const formatAge = (milliseconds) => {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
};

// Un sensor se da por desconectado si pasan 3 intervalos del dispositivo (mínimo 60 s) sin lecturas.
export const staleAfterMs = (intervalSeconds) => Math.max(60, 3 * (Number(intervalSeconds) || 15)) * 1000;

// Devuelve { state: 'ok' | 'alert' | 'stale' | 'never', label, detail }.
// Los umbrales de alerta son los mismos que usa el servidor (cultivo: humedad mínima, agua mínima, temperatura máxima).
export const sensorStatus = (sensor, crop, intervalSeconds, nowMs = Date.now()) => {
  if (!sensor?.last_reading_at) {
    return { state: 'never', label: SENSOR_STATES.never.label, detail: 'Aún no ha enviado datos.' };
  }
  const readingMs = new Date(sensor.last_reading_at).getTime();
  const ageMs = nowMs - readingMs;
  if (!Number.isFinite(readingMs) || ageMs > staleAfterMs(intervalSeconds)) {
    return {
      state: 'stale',
      label: SENSOR_STATES.stale.label,
      detail: Number.isFinite(readingMs) ? `Última lectura hace ${formatAge(ageMs)}.` : 'La fecha de la última lectura no es válida.',
    };
  }
  const value = Number(sensor.last_value);
  if (sensor.kind === 'soil_humidity' && isSet(crop?.humidity_min) && value < Number(crop.humidity_min)) {
    return { state: 'alert', label: SENSOR_STATES.alert.label, detail: `Por debajo del mínimo de humedad (${crop.humidity_min}%).` };
  }
  if (sensor.kind === 'water_level' && isSet(crop?.alert_water_min) && value < Number(crop.alert_water_min)) {
    return { state: 'alert', label: SENSOR_STATES.alert.label, detail: `Por debajo del mínimo de agua (${crop.alert_water_min}%).` };
  }
  if (sensor.kind === 'temperature' && isSet(crop?.alert_temp_max) && value > Number(crop.alert_temp_max)) {
    return { state: 'alert', label: SENSOR_STATES.alert.label, detail: `Por encima del máximo de temperatura (${crop.alert_temp_max} °C).` };
  }
  return { state: 'ok', label: SENSOR_STATES.ok.label, detail: `Actualizado hace ${formatAge(ageMs)}.` };
};

export const DEFAULT_LAYOUT = { rows: 2, cols: 2 };

export const layoutOf = (crop) => ({
  rows: Number(crop?.layout_rows) >= 1 ? Number(crop.layout_rows) : DEFAULT_LAYOUT.rows,
  cols: Number(crop?.layout_cols) >= 1 ? Number(crop.layout_cols) : DEFAULT_LAYOUT.cols,
});
