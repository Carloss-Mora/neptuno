// Modelo físico simplificado del suelo para el Laboratorio de simulación (sin dependencias de PocketBase).
// Valores ilustrativos para probar el software: NO son parámetros agronómicos ni de un sensor real.
const HUMIDITY_RISE_PER_MIN = 1.5; // % que sube la humedad por minuto mientras se riega
const HUMIDITY_FALL_PER_MIN = 0.5; // % que baja por minuto sin riego
const WATER_USE_PER_MIN = 0.4; // % del tanque que se consume por minuto de riego
const OFFLINE_SAFE_STOP_MINUTES = 10; // minutos simulados sin lectura válida antes de la parada segura
const FAULTS = ['none', 'sensor_offline', 'invalid_reading', 'no_response'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round1 = (value) => Math.round(value * 10) / 10;

const isValidReading = ({ soilHumidity, temperature, waterLevel }) => (
  Number.isFinite(soilHumidity) && soilHumidity >= 0 && soilHumidity <= 100
  && Number.isFinite(temperature) && temperature >= -10 && temperature <= 60
  && Number.isFinite(waterLevel) && waterLevel >= 0 && waterLevel <= 100
);

// Avanza stepMinutes minutos de tiempo simulado.
const physics = ({ humidity, waterLevel, irrigating, fault, stepMinutes }) => {
  const flowing = irrigating && waterLevel > 0;
  const rises = flowing && fault !== 'no_response';
  const nextHumidity = rises
    ? humidity + HUMIDITY_RISE_PER_MIN * stepMinutes
    : humidity - (irrigating ? 0 : HUMIDITY_FALL_PER_MIN * stepMinutes);
  const nextWater = flowing ? waterLevel - WATER_USE_PER_MIN * stepMinutes : waterLevel;
  return {
    humidity: round1(clamp(nextHumidity, 0, 100)),
    waterLevel: round1(clamp(nextWater, 0, 100)),
  };
};

module.exports = {
  HUMIDITY_RISE_PER_MIN,
  HUMIDITY_FALL_PER_MIN,
  WATER_USE_PER_MIN,
  OFFLINE_SAFE_STOP_MINUTES,
  FAULTS,
  clamp,
  round1,
  isValidReading,
  physics,
};
