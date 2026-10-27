// Decide si conviene NO empezar a regar porque se espera lluvia.
// Solo evita iniciar riegos: apagar por humedad recuperada sigue mandando el suelo.
const FORECAST_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const DEFAULT_THRESHOLD_MM = 2;
const VERY_DRY_MARGIN = 10;

module.exports = {
  FORECAST_MAX_AGE_MS,
  DEFAULT_THRESHOLD_MM,
  VERY_DRY_MARGIN,

  thresholdMm(crop) {
    const value = Number(crop.get('rain_threshold_mm'));
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_THRESHOLD_MM;
  },

  hasLocation(crop) {
    const lat = Number(crop.get('latitude'));
    const lon = Number(crop.get('longitude'));
    return Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);
  },

  // humidity y humidityMin son opcionales (modo programado no los usa).
  // Si el suelo está muy seco (más de 10 puntos bajo el mínimo) se riega igual: no se arriesga el cultivo.
  shouldSkip(crop, nowMs, humidity, humidityMin) {
    if (!crop.get('rain_skip') || !this.hasLocation(crop)) return false;
    const at = crop.get('rain_forecast_at') ? new Date(String(crop.get('rain_forecast_at')).replace(' ', 'T')).getTime() : NaN;
    if (!Number.isFinite(at) || nowMs - at > FORECAST_MAX_AGE_MS || nowMs - at < -60000) return false;
    if (Number(crop.get('rain_forecast_mm')) < this.thresholdMm(crop)) return false;
    if (Number.isFinite(humidity) && Number.isFinite(humidityMin) && humidity < humidityMin - VERY_DRY_MARGIN) return false;
    return true;
  },

  // Suma la precipitación de las próximas `hours` horas a partir de `nowMs`.
  // times: ["2026-10-26T22:00", ...] en UTC; mm: mismos índices.
  sumNextHours(times, mm, nowMs, hours = 6) {
    const start = nowMs - (nowMs % 3600000);
    const end = start + hours * 3600000;
    let total = 0;
    let counted = 0;
    for (let i = 0; i < times.length; i++) {
      const t = new Date(`${times[i]}:00Z`).getTime();
      if (t >= start && t < end && Number.isFinite(Number(mm[i]))) {
        total += Number(mm[i]);
        counted++;
      }
    }
    return counted ? Math.round(total * 10) / 10 : null;
  },
};
