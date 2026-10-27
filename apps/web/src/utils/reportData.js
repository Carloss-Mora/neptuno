import { buildIrrigationSessions } from '@/utils/irrigationMetrics';
import { sensorStatus } from '@/utils/sensorStatus';

const pad = (number) => String(number).padStart(2, '0');
export const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const sessionEnd = (session) => (session.closingDate
  ? new Date(session.closingDate)
  : new Date(new Date(session.activationDate).getTime() + Math.max(0, Number(session.durationMs) || 0)));

// Minutos de riego, número de riegos y litros (caudal × minutos reales) de cada día del periodo.
export const dailyBreakdown = (sessions, from, to, flowLpm) => {
  const hasFlow = (Number.isFinite(Number(flowLpm)) && Number(flowLpm) > 0) || sessions.some((session) => Number(session.flowLpm) > 0);
  const rows = [];
  for (let day = startOfDay(from); day <= to; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    const dayStart = day.getTime();
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
    let minutes = 0;
    let liters = 0;
    let started = 0;
    for (const session of sessions) {
      const start = new Date(session.activationDate).getTime();
      const end = sessionEnd(session).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      if (start >= dayStart && start < dayEnd) started += 1;
      const overlap = Math.max(0, Math.min(end, dayEnd) - Math.max(start, dayStart)) / 60000;
      minutes += overlap;
      const flow = Number(session.flowLpm) > 0 ? Number(session.flowLpm) : Number(flowLpm);
      if (Number.isFinite(flow) && flow > 0) liters += overlap * flow;
    }
    rows.push({ date: dateKey(day), sessions: started, minutes, liters: hasFlow ? liters : null });
  }
  return rows;
};

const METRICS = [
  ['humidity', 'Humedad del suelo', '%'],
  ['temperature', 'Temperatura', '°C'],
  ['water_level', 'Nivel de agua', '%'],
];

// hours: [{ hour, humidity, temperature, water_level, samples }]
export const sensorSummary = (hours) => METRICS.map(([key, label, unit]) => {
  const valid = hours.filter((row) => Number.isFinite(Number(row[key])));
  if (valid.length === 0) return { key, label, unit, average: null, minimum: null, maximum: null, samples: 0 };
  const samples = valid.reduce((total, row) => total + (Number(row.samples) || 1), 0);
  const weighted = valid.reduce((total, row) => total + Number(row[key]) * (Number(row.samples) || 1), 0);
  const values = valid.map((row) => Number(row[key]));
  return { key, label, unit, average: weighted / samples, minimum: Math.min(...values), maximum: Math.max(...values), samples };
});

export const buildReport = ({ crop, logs = [], hours = [], sensors = [], zones = [], zoneFlows = null, deviceIntervalSeconds, from, to, now = new Date() }) => {
  const zoneFlowTotal = zoneFlows instanceof Map ? [...zoneFlows.values()].reduce((total, value) => total + (Number(value) || 0), 0) : 0;
  const flowLpm = Number(crop?.flow_lpm) > 0 ? Number(crop.flow_lpm) : (zoneFlowTotal > 0 ? zoneFlowTotal : null);
  const zoneNames = new Map(zones.map((zone) => [zone.id, zone.name]));
  const sessions = buildIrrigationSessions(logs.filter((log) => !log.is_demo), now, zoneFlows).filter((session) => {
    const end = sessionEnd(session);
    return end >= from && new Date(session.activationDate) <= to;
  });
  const daily = dailyBreakdown(sessions, from, to, flowLpm);
  const totalMinutes = daily.reduce((total, row) => total + row.minutes, 0);
  const totalSessions = daily.reduce((total, row) => total + row.sessions, 0);
  const liters = daily.some((row) => row.liters !== null) ? daily.reduce((total, row) => total + (row.liters || 0), 0) : null;
  const peak = daily.reduce((best, row) => (row.minutes > (best?.minutes ?? 0) ? row : best), null);
  const sessionRows = sessions
    .filter((session) => new Date(session.activationDate) >= from && new Date(session.activationDate) <= to)
    .map((session) => {
      const minutes = Math.max(0, Number(session.durationMs) || 0) / 60000;
      return {
        start: new Date(session.activationDate),
        end: session.closingDate ? new Date(session.closingDate) : null,
        minutes,
        liters: Number(session.flowLpm) > 0 ? minutes * Number(session.flowLpm) : (flowLpm ? minutes * flowLpm : null),
        zone: session.zoneId ? (zoneNames.get(session.zoneId) || '') : '',
        source: session.source || '',
        active: Boolean(session.active),
      };
    });

  // Ahorro frente a un riego fijo de referencia (minutos por día habituales del cultivo). Puede ser negativo.
  const referenceMinutes = Number(crop?.reference_minutes_per_day) > 0 ? Number(crop.reference_minutes_per_day) : null;
  let savings = null;
  if (referenceMinutes && flowLpm && daily.length > 0) {
    const referenceLiters = referenceMinutes * flowLpm * daily.length;
    savings = {
      referenceMinutesPerDay: referenceMinutes,
      referenceLiters,
      savedLiters: referenceLiters - liters,
      savedPercent: ((referenceLiters - liters) / referenceLiters) * 100,
    };
  }

  return {
    cropName: crop?.name || 'Cultivo',
    areaM2: Number(crop?.area_m2) > 0 ? Number(crop.area_m2) : null,
    flowLpm,
    from,
    to,
    generatedAt: now,
    days: daily.length,
    totals: {
      sessions: totalSessions,
      minutes: totalMinutes,
      liters,
      averageMinutesPerSession: totalSessions > 0 ? totalMinutes / totalSessions : null,
      averageLitersPerDay: liters !== null && daily.length > 0 ? liters / daily.length : null,
      peakDay: peak ? { date: peak.date, minutes: peak.minutes, liters: peak.liters } : null,
    },
    savings,
    daily,
    sessions: sessionRows,
    hours,
    sensorSummary: sensorSummary(hours),
    sensors: sensors.map((sensor) => ({
      name: sensor.name,
      kind: sensor.kind,
      row: Number(sensor.grid_row) + 1,
      col: Number(sensor.grid_col) + 1,
      lastValue: sensor.last_reading_at ? Number(sensor.last_value) : null,
      lastReadingAt: sensor.last_reading_at || null,
      status: sensorStatus(sensor, crop, deviceIntervalSeconds, now.getTime()),
    })),
  };
};
