// Por qué empezó y por qué terminó un riego, según la fuente guardada en el registro.
const START = {
  MANUAL: 'Lo encendiste tú',
  THRESHOLD: 'La humedad bajó del mínimo',
  SCHEDULE: 'Horario programado',
  AUTOMATIC: 'Modo automático',
  WATCHDOG: 'Control de seguridad',
  PULSE: 'Siguiente pulso del riego por pulsos',
};
const END = {
  MANUAL: 'Lo apagaste tú',
  THRESHOLD: 'La humedad llegó al máximo o se cumplió el límite de tiempo',
  SCHEDULE: 'Terminó el horario',
  AUTOMATIC: 'Modo automático',
  WATCHDOG: 'Apagado de seguridad (el dispositivo dejó de reportar)',
  PULSE: 'Pausa entre pulsos',
};

export const startReason = (source) => START[source] || 'Registro del sistema';
export const endReason = (source) => (source ? END[source] || 'Registro del sistema' : '');
