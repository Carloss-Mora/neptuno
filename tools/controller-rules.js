// Reglas del controlador físico cuando pierde contacto con el servidor (fase 5: sin internet).
// El firmware (firmware/neptuno-controller) implementa estas mismas reglas; este módulo las deja
// probadas y las usa el simulador de dispositivo (tools/simulate-device.js).
//
//   1. Con contacto reciente (hasta hold_seconds) se obedece lo último que dijo el servidor.
//   2. Sin contacto y en modo AUTOMÁTICO con umbrales válidos, el controlador sigue regando solo con las
//      mismas reglas del servidor (histéresis, máximo de riego, descanso, pulsos), hasta AUTONOMOUS_MAX_MS.
//   3. En cualquier otro caso (manual, horario, sin umbrales, sensor dañado, nivel de agua bajo, o pasado el
//      límite autónomo) cierra todas las válvulas: "ante la duda, cerrado".
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const AUTONOMOUS_MAX_MS = 6 * 60 * 60 * 1000;

const loadPolicy = () => {
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../apps/pocketbase/pb_hooks/irrigation-policy.js'), 'utf8'), sandbox);
  return sandbox.module.exports;
};
const policy = loadPolicy();

const closed = (zones) => zones.map((zone) => ({ ...zone, state: 'OFF', reason: 'failsafe' }));

// input: {
//   nowMs, lastContactMs, holdMs, config (de la última respuesta), sensorsOk, waterLevel,
//   serverZones: [{ channel, state }]   lo último que ordenó el servidor,
//   zones: [{ channel, humidity, state, activeSinceMs, lastStoppedAtMs, cycleOnMs, inPulseCycle }]  estado local
// }
// Devuelve { mode: 'online' | 'autonomous' | 'failsafe', zones: [{ channel, state, reason, pulse?, endCycle? }] }
const controllerStep = (input) => {
  const { nowMs, lastContactMs, holdMs, config, sensorsOk, waterLevel, serverZones = [], zones = [] } = input;
  const offlineMs = nowMs - lastContactMs;
  if (!Number.isFinite(offlineMs) || offlineMs < 0 || offlineMs <= holdMs) {
    return { mode: 'online', zones: serverZones.map((zone) => ({ channel: zone.channel, state: zone.state === 'ON' ? 'ON' : 'OFF', reason: 'server' })) };
  }
  const base = zones.length > 0 ? zones : serverZones;
  const usable = config && config.control_mode === 'AUTO'
    && config.humidity_min > 0 && config.humidity_max > config.humidity_min && config.max_irrigation_minutes > 0;
  if (!usable || !sensorsOk || offlineMs > holdMs + AUTONOMOUS_MAX_MS) {
    return { mode: 'failsafe', zones: closed(base) };
  }
  return {
    mode: 'autonomous',
    zones: zones.map((zone) => {
      const decision = policy.decide({
        humidity: zone.humidity,
        humidityMin: config.humidity_min,
        humidityMax: config.humidity_max,
        waterLevel,
        currentState: zone.state,
        nowMs,
        activeSinceMs: zone.activeSinceMs,
        lastStoppedAtMs: zone.lastStoppedAtMs,
        maxContinuousMs: config.max_irrigation_minutes * 60000,
        minRestMs: (config.min_rest_minutes || 0) * 60000,
        pulseOnMs: (config.pulse_on_minutes || 0) * 60000,
        pulseOffMs: (config.pulse_off_minutes || 0) * 60000,
        inPulseCycle: Boolean(zone.inPulseCycle),
        cycleOnMs: zone.cycleOnMs || 0,
      });
      return { channel: zone.channel, state: decision.state, reason: decision.reason, pulse: decision.pulse, endCycle: decision.endCycle };
    }),
  };
};

module.exports = { AUTONOMOUS_MAX_MS, controllerStep };
