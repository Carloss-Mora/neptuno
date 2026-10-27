// Textos en español para las decisiones del motor de riego y los fallos simulados.
export const REASON_LABELS = {
  humidity_low: 'Humedad por debajo del mínimo: inicia el riego',
  hysteresis_hold: 'Entre los umbrales: mantiene el riego encendido',
  humidity_recovered: 'Humedad objetivo alcanzada: detiene el riego',
  humidity_sufficient: 'Humedad suficiente: no riega',
  low_water: 'Nivel de agua bajo: no se permite regar',
  maximum_runtime: 'Tiempo máximo de riego continuo: parada por seguridad',
  minimum_rest: 'Descanso mínimo entre riegos: espera',
  pulse_pause: 'Pausa entre pulsos: espera para que el agua se absorba',
  pulse_resume: 'Pausa cumplida: inicia otro pulso',
  rain_expected: 'Se espera lluvia: no inicia el riego',
  manual_override: 'Control manual vigente: el motor no decide',
  manual_mode: 'Cultivo en modo manual: el motor automático no decide',
  configuration_missing: 'Faltan umbrales o límites en el cultivo: no riega',
  sensor_offline: 'Sin lectura del sensor',
  invalid_reading: 'Lectura inválida rechazada',
  safe_stop_no_reading: 'Parada segura: demasiado tiempo sin lectura válida',
};

export const FAULT_OPTIONS = [
  { value: 'none', label: 'Normal', description: 'El sensor responde y el riego tiene efecto.' },
  { value: 'sensor_offline', label: 'Sensor desconectado', description: 'No llegan lecturas nuevas.' },
  { value: 'invalid_reading', label: 'Lectura inválida', description: 'El sensor envía un valor imposible (150 %).' },
  { value: 'no_response', label: 'Riego sin efecto', description: 'La humedad no sube aunque se riegue (válvula atascada, sin caudal).' },
];

const SAFETY_REASONS = ['safe_stop_no_reading', 'maximum_runtime', 'low_water'];

export const reasonLabel = (reason) => REASON_LABELS[reason] || (reason ? reason : 'Sin decisiones todavía');

export const irrigationLabel = (state, reason) => {
  if (state === 'ON') return { text: 'Regando', tone: 'on' };
  if (SAFETY_REASONS.includes(reason)) return { text: 'Detenido por seguridad', tone: 'safety' };
  if (state === 'OFF') return { text: 'Apagado', tone: 'off' };
  return { text: 'Sin iniciar', tone: 'off' };
};
