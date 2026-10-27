// Unidades que elige cada persona en Ajustes. Los datos siempre se guardan en litros y °C.
export const LITERS_PER_GALLON = 3.785411784;

export const DEFAULT_PREFERENCES = {
  timezone: '',
  unit_volume: 'L',
  unit_temp: 'C',
};

export const volumeUnitLabel = (unit) => (unit === 'gal' ? 'gal' : 'L');
export const tempUnitLabel = (unit) => (unit === 'F' ? '°F' : '°C');
export const flowUnitLabel = (unit) => (unit === 'gal' ? 'gal/min' : 'L/min');

export const volumeFromLiters = (liters, unit) => (unit === 'gal' ? liters / LITERS_PER_GALLON : liters);
export const tempFromCelsius = (celsius, unit) => (unit === 'F' ? (celsius * 9) / 5 + 32 : celsius);

const trim = (number, digits) => Number(number.toFixed(digits));

export const formatVolume = (liters, unit, digits = 1) => {
  if (!Number.isFinite(liters)) return '—';
  return `${trim(volumeFromLiters(liters, unit), digits).toLocaleString('es-CO')} ${volumeUnitLabel(unit)}`;
};

export const formatTemperature = (celsius, unit, digits = 1) => {
  if (!Number.isFinite(celsius)) return '—';
  return `${trim(tempFromCelsius(celsius, unit), digits).toLocaleString('es-CO')} ${tempUnitLabel(unit)}`;
};

export const isValidTimeZone = (timeZone) => {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('es-CO', { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const formatDateTime = (value, timeZone) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    ...(isValidTimeZone(timeZone) ? { timeZone } : {}),
  }).format(date).replace(/[\u202f\u00a0]/g, ' ');
};

export const TIME_ZONES = [
  ['America/Bogota', 'Colombia (Bogotá)'],
  ['America/Lima', 'Perú (Lima)'],
  ['America/Mexico_City', 'México (Ciudad de México)'],
  ['America/Santiago', 'Chile (Santiago)'],
  ['America/Argentina/Buenos_Aires', 'Argentina (Buenos Aires)'],
  ['America/New_York', 'Estados Unidos (Este)'],
  ['Europe/Madrid', 'España (Madrid)'],
];
