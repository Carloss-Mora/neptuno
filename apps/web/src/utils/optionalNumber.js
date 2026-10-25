// PocketBase devuelve 0 para un campo numérico vacío, aunque se haya enviado null.
// Para los parámetros del cultivo donde 0 no tiene sentido (umbrales, caudal, área,
// tiempo máximo de riego) tratamos "vacío, null o 0" como "sin configurar".

export const isProvided = (value) => value !== '' && value != null;

export const isSet = (value) => (
  isProvided(value) && Number.isFinite(Number(value)) && Number(value) > 0
);

export const toFormValue = (value, fallback = '') => (isSet(value) ? String(value) : fallback);

export const toNumberOrNull = (value) => (isSet(value) ? Number(value) : null);
