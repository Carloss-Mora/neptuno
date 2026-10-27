// Modelo de los datos de ejemplo: simula un cultivo de fresa en clima frío de altura (humedad por zona,
// temperatura con ciclo diario, lluvia ocasional por la tarde, tanque que se vacía y se rellena).
// Es una función pura: no toca la base de datos. demo-data.pb.js guarda lo que aquí se genera.
// Módulo CommonJS cargado con require() desde los hooks de PocketBase.

const STEP_MIN = 5;
const READ_EVERY = 4; // una lectura cada 20 minutos
const TZ_OFFSET_MIN = -300; // Colombia

const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const localHour = (ms) => {
  const d = new Date(ms + TZ_OFFSET_MIN * 60000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
};
const dayIndex = (ms) => Math.floor((ms + TZ_OFFSET_MIN * 60000) / 86400000);
const hash01 = (n) => rng(n * 2654435761)();
const isRainyDay = (ms) => hash01(dayIndex(ms)) < 0.22;
const isRaining = (ms) => {
  if (!isRainyDay(ms)) return false;
  const h = localHour(ms);
  return h >= 14 && h < 17.5;
};
const sunAt = (ms) => Math.max(0, Math.sin((Math.PI * (localHour(ms) - 6)) / 12));

const num = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback);

const paramsFromCrop = (crop) => ({
  hMin: num(crop.humidity_min, 65),
  hMax: num(crop.humidity_max, 80),
  maxMin: num(crop.max_irrigation_minutes, 20),
  restMin: num(crop.min_rest_minutes, 120),
  flowLpm: num(crop.flow_lpm, 8),
  tankLiters: 2000,
});

const newState = (startMs, zoneCount, seed) => {
  const rand = rng(seed || 7);
  const zones = [];
  for (let i = 0; i < Math.max(1, zoneCount); i += 1) {
    zones.push({ h: 70 + rand() * 8, on: false, onMs: 0, restMs: 1e9, factor: 0.9 + 0.12 * i + rand() * 0.08 });
  }
  return { t: startMs, step: 0, water: 88 + rand() * 6, zones, anyOn: false, seed: seed || 7 };
};

// Avanza el modelo hasta toMs y llama a emit() con cada lectura y cada cambio de riego.
//   emit({ type: 'reading', t, humidity, temperature, water, zoneHumidity: [..] })
//   emit({ type: 'log', t, status: 'ON'|'OFF', zone: index|null })   (zone null = el cultivo completo)
const advance = (state, params, toMs, emit) => {
  const rand = rng(state.seed + state.step);
  const multi = state.zones.length > 1;
  while (state.t + STEP_MIN * 60000 <= toMs) {
    state.t += STEP_MIN * 60000;
    state.step += 1;
    const t = state.t;
    const sun = sunAt(t);
    const raining = isRaining(t);
    const rainy = isRainyDay(t);
    const temperature = 12.5 + 8.5 * sun - (rainy ? 2 : 0) + (rand() - 0.5) * 0.8;

    state.zones.forEach((zone, index) => {
      zone.h -= (0.010 + 0.028 * sun) * STEP_MIN * zone.factor;
      if (raining) zone.h += 0.95;
      if (zone.on) {
        zone.h += 0.85 * STEP_MIN;
        zone.onMs += STEP_MIN * 60000;
        state.water -= (params.flowLpm / state.zones.length) * STEP_MIN / params.tankLiters * 100;
        if (zone.h >= params.hMax - 1 || zone.onMs >= params.maxMin * 60000) {
          zone.on = false;
          zone.restMs = 0;
          if (multi) emit({ type: 'log', t, status: 'OFF', zone: index });
        }
      } else {
        zone.restMs += STEP_MIN * 60000;
        if (zone.h < params.hMin && zone.restMs >= params.restMin * 60000 && !raining) {
          zone.on = true;
          zone.onMs = 0;
          if (multi) emit({ type: 'log', t, status: 'ON', zone: index });
        }
      }
      zone.h = Math.min(95, Math.max(20, zone.h));
    });

    const anyOn = state.zones.some((zone) => zone.on);
    if (anyOn !== state.anyOn) {
      state.anyOn = anyOn;
      emit({ type: 'log', t, status: anyOn ? 'ON' : 'OFF', zone: null });
    }
    if (state.water < 28) state.water = 96;

    if (state.step % READ_EVERY === 0) {
      const zoneHumidity = state.zones.map((zone) => Math.min(100, Math.max(0, zone.h + (rand() - 0.5) * 0.8)));
      const humidity = zoneHumidity.reduce((a, b) => a + b, 0) / zoneHumidity.length;
      emit({ type: 'reading', t, humidity, temperature, water: Math.min(100, Math.max(0, state.water + (rand() - 0.5) * 0.3)), zoneHumidity });
    }
  }
};

module.exports = { STEP_MIN, rng, paramsFromCrop, newState, advance, isRainyDay, isRaining, localHour };
