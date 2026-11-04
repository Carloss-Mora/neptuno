// Experimento numérico: riego con temporizador fijo vs. riego automático de Neptuno.
//
// Qué es: una simulación del balance hídrico de la zona de raíces de una fresa regada por goteo,
// con 150 días de ciclo (60 vegetativo, 30 floración, 60 fructificación). La decisión de riego de
// Neptuno NO se reimplementa: se llama al mismo `irrigation-policy.decide()` y a `rain-guard.shouldSkip()`
// que usa el servidor (apps/pocketbase/pb_hooks). Lo único simulado es el suelo y el clima.
//
// Qué NO es: una medición de campo. Los resultados dependen de los supuestos de abajo (suelo, clima y
// coeficientes de cultivo) y sirven para comparar estrategias de control bajo las mismas condiciones,
// no para prometer un ahorro en una finca concreta.
//
// Uso:  node tools/experiment-water-saving.mjs [--seasons 100] [--out resultados.json]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Los hooks de PocketBase son CommonJS: se cargan en un contexto aislado, igual que en las pruebas.
const loadHook = (name) => {
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(readFileSync(path.join(root, 'apps/pocketbase/pb_hooks', name), 'utf8'), sandbox);
  return sandbox.module.exports;
};
const policy = loadHook('irrigation-policy.js');
const rainGuard = loadHook('rain-guard.js');
const { STRAWBERRY_STAGE_DEFAULTS } = await import(path.join(root, 'apps/web/src/utils/strawberryStages.js'));

const argv = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const SEASONS = Number(argValue('--seasons', 100));
const OUT = argValue('--out', '');

// ---------------------------------------------------------------- supuestos (todos editables)
const STEP_MIN = 10; // intervalo de lectura del dispositivo
const STAGES = [
  { name: 'vegetativo', days: 60, kc: 0.4 },
  { name: 'floración', days: 30, kc: 0.5 },
  { name: 'fructificación', days: 60, kc: 0.6 },
]; // Kc: guía para fresa en acolchado (Migliaccio et al., 2019, UF/IFAS AE456): 0.27-0.47 inicial, 0.5 medio, 0.6 final
const SOIL = {
  thetaSat: 0.375, // humedad volumétrica a la que el sensor marca 100 %
  thetaFc: 0.3, // capacidad de campo (el sensor marca 80 %)
  thetaWp: 0.15, // punto de marchitez (40 %)
  rootDepthMm: 250,
  depletionP: 0.2, // fracción del agua disponible que se puede agotar sin estrés (p, FAO-56)
};
const DRIP_MM_PER_HOUR = 2; // lámina del goteo: cinta de 0,5 gal/min por 100 pies (LSU AgCenter) en camas de 1,83 m ≈ 2 mm/h
const SENSOR_NOISE_PCT = 1; // desviación estándar del ruido del sensor
const ET0_MEAN = 3.0; // mm/día, clima frío de altura (supuesto; se varía ±25 % en la sensibilidad)
const ET0_SD = 0.5;
const FORECAST = { hit: 0.7, falseAlarm: 0.1, falseMm: 3 }; // calidad supuesta del pronóstico de lluvia
const RAIN_MEAN_MM = 9;
const CLIMATES = {
  humedo: { pWetAfterDry: 0.3, pWetAfterWet: 0.55 }, // ~12 días de lluvia al mes (~110 mm/mes)
  seco: { pWetAfterDry: 0.1, pWetAfterWet: 0.4 }, // ~4 días de lluvia al mes (~40 mm/mes)
};

// ---------------------------------------------------------------- utilidades
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gaussian = (rand) => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const stageOf = (day) => (day < 60 ? 0 : day < 90 ? 1 : 2);

// Clima de una temporada: lluvia por paso de 10 min y ET0 por paso.
function makeWeather(seed, climate, et0Scale) {
  const rand = mulberry32(seed);
  const days = STAGES.reduce((s, x) => s + x.days, 0);
  const stepsPerDay = (24 * 60) / STEP_MIN;
  const rain = new Float64Array(days * stepsPerDay);
  const et0 = new Float64Array(days * stepsPerDay);
  let wet = rand() < 0.3;
  for (let d = 0; d < days; d += 1) {
    wet = rand() < (wet ? climate.pWetAfterWet : climate.pWetAfterDry);
    const dayEt0 = clamp(ET0_MEAN + ET0_SD * gaussian(rand), 1.8, 4.8) * et0Scale * (wet ? 0.6 : 1);
    // ET0 repartida entre las 6:00 y las 18:00 con forma de seno.
    let shapeSum = 0;
    for (let s = 0; s < stepsPerDay; s += 1) {
      const h = (s * STEP_MIN) / 60;
      if (h >= 6 && h < 18) shapeSum += Math.sin(((h - 6) / 12) * Math.PI);
    }
    for (let s = 0; s < stepsPerDay; s += 1) {
      const h = (s * STEP_MIN) / 60;
      et0[d * stepsPerDay + s] = h >= 6 && h < 18 ? (dayEt0 * Math.sin(((h - 6) / 12) * Math.PI)) / shapeSum : 0;
    }
    if (wet) {
      const total = Math.max(1, -RAIN_MEAN_MM * Math.log(1 - rand()));
      const startH = 12 + Math.floor(rand() * 6); // la lluvia cae en la tarde, durante 3 h
      const n = (3 * 60) / STEP_MIN;
      for (let k = 0; k < n; k += 1) rain[d * stepsPerDay + (startH * 60) / STEP_MIN + k] = total / n;
    }
  }
  // Pronóstico de lluvia de las próximas 6 h por paso (con aciertos, omisiones y falsas alarmas).
  const forecast = new Float64Array(rain.length);
  const ahead = (6 * 60) / STEP_MIN;
  for (let i = 0; i < rain.length; i += 1) {
    let truth = 0;
    for (let k = 1; k <= ahead && i + k < rain.length; k += 1) truth += rain[i + k];
    if (truth >= 1) forecast[i] = rand() < FORECAST.hit ? truth : 0;
    else forecast[i] = rand() < FORECAST.falseAlarm ? FORECAST.falseMm : 0;
  }
  return { rain, et0, forecast, steps: rain.length, stepsPerDay };
}

// ---------------------------------------------------------------- estrategias
const fixedTimer = (minutesPerDay) => ({
  label: `Temporizador fijo ${minutesPerDay} min/día`,
  kind: 'fixed',
  minutesByStage: [minutesPerDay, minutesPerDay, minutesPerDay],
});
// Calendario por etapas inspirado en la guía de goteo en fresa de LSU AgCenter (20-70 min/día según la etapa).
const stageTimer = () => ({
  label: 'Temporizador por etapas (guía LSU)',
  kind: 'fixed',
  minutesByStage: [25, 25, 45],
});
const neptuno = (label, { rain, calibrated }) => ({ label, kind: 'neptuno', rain, calibrated });

const stageConfig = (strategy, stageIndex) => {
  const preset = STRAWBERRY_STAGE_DEFAULTS[STAGES[stageIndex].name];
  if (!strategy.calibrated) return preset;
  // Umbral calibrado: se riega cuando el agua agotada llega al límite sin estrés (7,5 mm = 72 % en el sensor).
  return { ...preset, humidity_min: 72, humidity_max: 80, min_rest_minutes: 30, max_irrigation_minutes: 30 };
};

// ---------------------------------------------------------------- una temporada
function runSeason(strategy, weather, seed, trace = false) {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const taw = (SOIL.thetaFc - SOIL.thetaWp) * SOIL.rootDepthMm;
  const raw = SOIL.depletionP * taw;
  let theta = 0.27; // empieza algo por debajo de la capacidad de campo
  let applied = 0; let drained = 0; let drainedIrrigation = 0; let etaSum = 0; let etcSum = 0; let rainSum = 0;
  let valveMinutes = 0; let events = 0; let skips = 0; let stressSteps = 0; let overFc = 0;
  let state = 'OFF'; let activeSince = NaN; let lastStopped = NaN;
  const t0 = Date.UTC(2026, 0, 1);
  const series = [];
  for (let i = 0; i < weather.steps; i += 1) {
    const day = Math.floor(i / weather.stepsPerDay);
    const stageIndex = stageOf(day);
    const nowMs = t0 + i * STEP_MIN * 60000;
    const minuteOfDay = (i % weather.stepsPerDay) * STEP_MIN;

    // Lectura del sensor (con ruido) y decisión.
    const reading = clamp((theta / SOIL.thetaSat) * 100 + SENSOR_NOISE_PCT * gaussian(rand), 0, 100);
    let next = state;
    if (strategy.kind === 'fixed') {
      next = minuteOfDay >= 6 * 60 && minuteOfDay < 6 * 60 + strategy.minutesByStage[stageIndex] ? 'ON' : 'OFF';
    } else {
      const cfg = stageConfig(strategy, stageIndex);
      const decision = policy.decide({
        humidity: reading,
        humidityMin: cfg.humidity_min,
        humidityMax: cfg.humidity_max,
        waterLevel: 100,
        currentState: state,
        nowMs,
        activeSinceMs: activeSince,
        lastStoppedAtMs: lastStopped,
        maxContinuousMs: cfg.max_irrigation_minutes * 60000,
        minRestMs: cfg.min_rest_minutes * 60000,
        manualOverrideUntilMs: 0,
        pulseOnMs: 0,
        pulseOffMs: 0,
        inPulseCycle: false,
        cycleOnMs: 0,
      });
      next = decision.state;
      if (strategy.rain && next === 'ON' && state !== 'ON' && decision.reason === 'humidity_low') {
        const crop = {
          get: (key) => ({
            rain_skip: true, growing_environment: 'open', latitude: 5.45, longitude: -73.69,
            rain_forecast_at: new Date(nowMs).toISOString(), rain_forecast_mm: weather.forecast[i], rain_threshold_mm: 2,
          }[key]),
        };
        if (rainGuard.shouldSkip(crop, nowMs, reading, cfg.humidity_min)) { next = 'OFF'; skips += 1; }
      }
    }
    if (next === 'ON' && state !== 'ON') { activeSince = nowMs; events += 1; }
    if (next === 'OFF' && state === 'ON') lastStopped = nowMs;
    state = next;

    // Balance hídrico del paso.
    const irrigation = state === 'ON' ? (DRIP_MM_PER_HOUR * STEP_MIN) / 60 : 0;
    if (state === 'ON') valveMinutes += STEP_MIN;
    const rainMm = weather.rain[i];
    const etc = STAGES[stageIndex].kc * weather.et0[i];
    const depletion = Math.max(0, (SOIL.thetaFc - theta) * SOIL.rootDepthMm);
    const ks = depletion <= raw ? 1 : clamp((taw - depletion) / ((1 - SOIL.depletionP) * taw), 0, 1);
    const eta = etc * ks;
    etcSum += etc; etaSum += eta; applied += irrigation; rainSum += rainMm;
    if (etc > 0 && ks < 0.95) stressSteps += 1;
    theta += (irrigation + rainMm - eta) / SOIL.rootDepthMm;
    if (theta > SOIL.thetaFc) {
      const excess = (theta - SOIL.thetaFc) * SOIL.rootDepthMm;
      drained += excess;
      // El drenaje solo ocurre en pasos con entradas de agua: se reparte entre riego y lluvia en proporción.
      drainedIrrigation += excess * (irrigation / (irrigation + rainMm));
      theta = SOIL.thetaFc; overFc += 1;
    }
    theta = Math.max(SOIL.thetaWp * 0.8, theta);
    if (trace && i % 6 === 0) series.push({ day: i / weather.stepsPerDay, sensor: Math.round((theta / SOIL.thetaSat) * 1000) / 10, irrigation, rain: rainMm });
  }
  return {
    applied, drained, drainedIrrigation, rainSum, etaSum, etcSum,
    relativeEt: etaSum / etcSum,
    stressDays: stressSteps / (weather.stepsPerDay / 2), // pasos con ET > 0 son 72 por día
    valveMinutes, events, skips, series,
    lossPct: (drained / Math.max(1, applied + rainSum)) * 100,
    irrigationLossPct: applied > 0 ? (drainedIrrigation / applied) * 100 : 0,
  };
}

// ---------------------------------------------------------------- campaña
const strategies = [
  fixedTimer(20), fixedTimer(30), fixedTimer(45), fixedTimer(60), stageTimer(),
  neptuno('Neptuno AUTO (valores sugeridos)', { rain: false, calibrated: false }),
  neptuno('Neptuno AUTO calibrado', { rain: false, calibrated: true }),
  neptuno('Neptuno AUTO calibrado + guardia de lluvia', { rain: true, calibrated: true }),
];
const toMonthly = (mm) => (mm / 150) * 30; // L/m² por mes (1 mm = 1 L/m²)

const results = {};
for (const [climateName, climate] of Object.entries(CLIMATES)) {
  for (const et0Scale of [0.75, 1, 1.25]) {
    const key = `${climateName}|ET0x${et0Scale}`;
    const rows = strategies.map((strategy) => ({ strategy, runs: [] }));
    for (let s = 0; s < SEASONS; s += 1) {
      const seed = 1000 + s;
      const weather = makeWeather(seed, climate, et0Scale);
      rows.forEach((row) => row.runs.push(runSeason(row.strategy, weather, seed)));
    }
    results[key] = rows.map(({ strategy, runs }) => {
      const field = (name) => runs.map((r) => r[name]);
      return {
        strategy: strategy.label,
        appliedMm: { mean: mean(field('applied')), sd: sd(field('applied')) },
        appliedMonthly: { mean: toMonthly(mean(field('applied'))) },
        drainedMm: { mean: mean(field('drained')), sd: sd(field('drained')) },
        drainedIrrigationMm: { mean: mean(field('drainedIrrigation')), sd: sd(field('drainedIrrigation')) },
        irrigationLossPct: mean(field('irrigationLossPct')),
        relativeEt: { mean: mean(field('relativeEt')), sd: sd(field('relativeEt')) },
        stressDays: { mean: mean(field('stressDays')), sd: sd(field('stressDays')) },
        valveHours: mean(field('valveMinutes')) / 60,
        events: mean(field('events')),
        skips: mean(field('skips')),
        rainMm: mean(field('rainSum')),
        etcMm: mean(field('etcSum')),
      };
    });
  }
}

// Una temporada de ejemplo (clima húmedo, ET0 medio, semilla 1000) para graficar.
const sampleWeather = makeWeather(1000, CLIMATES.humedo, 1);
const sample = {
  fixed45: runSeason(strategies[2], sampleWeather, 1000, true).series,
  neptuno: runSeason(strategies[7], sampleWeather, 1000, true).series,
};

const output = {
  parameters: { SEASONS, STEP_MIN, STAGES, SOIL, DRIP_MM_PER_HOUR, SENSOR_NOISE_PCT, ET0_MEAN, ET0_SD, FORECAST, RAIN_MEAN_MM, CLIMATES },
  results,
  sample,
};
if (OUT) writeFileSync(OUT, JSON.stringify(output, null, 1));

const f = (v, d = 1) => v.toFixed(d);
for (const [key, rows] of Object.entries(results)) {
  console.log(`\n== ${key}  (${SEASONS} temporadas de 150 días)`);
  console.log('estrategia'.padEnd(46), 'riego mm'.padStart(9), 'L/m²·mes'.padStart(9), 'perd.riego'.padStart(10), '%perd.'.padStart(7), 'ETa/ETc'.padStart(8), 'días estrés'.padStart(12), 'eventos'.padStart(8), 'omitidos'.padStart(9));
  for (const r of rows) {
    console.log(r.strategy.padEnd(46), f(r.appliedMm.mean, 0).padStart(9), f(r.appliedMonthly.mean).padStart(9), f(r.drainedIrrigationMm.mean, 0).padStart(10), f(r.irrigationLossPct, 0).padStart(7), f(r.relativeEt.mean, 3).padStart(8), f(r.stressDays.mean).padStart(12), f(r.events, 0).padStart(8), f(r.skips, 1).padStart(9));
  }
}
