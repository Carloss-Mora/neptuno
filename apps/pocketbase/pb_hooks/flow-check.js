// Compara el caudal medido con el esperado y detecta fugas (agua que pasa con la válvula cerrada)
// u obstrucciones (poca agua con la válvula abierta). Solo actúa con un caudal medido reciente.
const GRACE_MS = 2 * 60 * 1000; // la línea tarda en llenarse o vaciarse al abrir o cerrar la válvula
const LOW_RATIO = 0.5; // menos de la mitad del caudal esperado = obstrucción
const LEAK_MIN_LPM = 0.3;
const LEAK_RATIO = 0.1;

module.exports = {
  GRACE_MS,
  // measured: L/min (NaN si el dispositivo no lo mide); expected: caudal configurado del cultivo;
  // valveOn: estado deseado; stateSinceMs: desde cuándo está en ese estado.
  check({ measured, expected, valveOn, stateSinceMs, nowMs }) {
    if (!Number.isFinite(measured) || !(expected > 0) || !Number.isFinite(stateSinceMs)) return '';
    if (nowMs - stateSinceMs < GRACE_MS) return '';
    if (valveOn) return measured < expected * LOW_RATIO ? 'flow_low' : '';
    return measured > Math.max(LEAK_MIN_LPM, expected * LEAK_RATIO) ? 'flow_leak' : '';
  },
};
