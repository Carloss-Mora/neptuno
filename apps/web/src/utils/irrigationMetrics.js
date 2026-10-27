const LITERS_PER_MINUTE_LABEL = 'L/min';

const weekDayNumber = (value) => {
  if (Number.isInteger(value) && value >= 0 && value <= 6) return value;
  const key = String(value).toLowerCase();
  const days = {
    sun: 0, sunday: 0, domingo: 0,
    mon: 1, monday: 1, lunes: 1,
    tue: 2, tuesday: 2, martes: 2,
    wed: 3, wednesday: 3, miercoles: 3, miércoles: 3,
    thu: 4, thursday: 4, jueves: 4,
    fri: 5, friday: 5, viernes: 5,
    sat: 6, saturday: 6, sabado: 6, sábado: 6,
  };
  return days[key] ?? null;
};

const parseDays = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const scheduleOccursOn = (schedule, date) => {
  const recurrence = schedule?.recurrence || 'ONCE';
  if (recurrence === 'DAILY') return true;
  if (recurrence === 'WEEKLY') {
    return parseDays(schedule.days).some((day) => weekDayNumber(day) === date.getDay());
  }
  const dateValue = schedule?.date || schedule?.startDate;
  return Boolean(dateValue && dateValue === formatLocalDateKey(date));
};

const parseSchedules = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return value.split(',').map((time) => ({ startTime: time.trim() }));
  }

  return [];
};

export const getActiveSchedule = (value, referenceDate = new Date()) => {
  const schedules = parseSchedules(value);

  for (const schedule of schedules) {
    const dateValue = schedule?.date || schedule?.startDate;
    const startTime = schedule?.startTime || schedule?.time;
    const endTime = schedule?.endTime;
    if (!startTime || !endTime || !scheduleOccursOn(schedule, referenceDate)) continue;

    const [year, month, day] = formatLocalDateKey(referenceDate).split('-').map(Number);
    const [startHours, startMinutes] = String(startTime).split(':').map(Number);
    const [endHours, endMinutes] = String(endTime).split(':').map(Number);
    const startDate = new Date(year, month - 1, day, startHours, startMinutes);
    const endDate = new Date(year, month - 1, day, endHours, endMinutes);

    if (
      Number.isNaN(startDate.getTime())
      || Number.isNaN(endDate.getTime())
      || startDate >= endDate
    ) continue;

    if (startDate <= referenceDate && referenceDate < endDate) {
      return { ...schedule, startDate, endDate };
    }
  }

  return null;
};

export const getScheduleState = (schedule, referenceDate = new Date()) => {
  const startTime = schedule?.startTime || schedule?.time;
  const endTime = schedule?.endTime;
  const dateValue = schedule?.date || schedule?.startDate;
  const recurrence = schedule?.recurrence || 'ONCE';
  if (!startTime || !endTime || (recurrence === 'ONCE' && !dateValue)) return 'unknown';
  if (recurrence !== 'ONCE' && !scheduleOccursOn(schedule, referenceDate)) return 'upcoming';
  const scheduleDate = recurrence === 'ONCE' ? dateValue : formatLocalDateKey(referenceDate);

  const [year, month, day] = String(scheduleDate).split('-').map(Number);
  const [startHours, startMinutes] = String(startTime).split(':').map(Number);
  const startDate = new Date(year, month - 1, day, startHours, startMinutes);
  const [endHours, endMinutes] = String(endTime || '').split(':').map(Number);
  const endDate = new Date(year, month - 1, day, endHours, endMinutes);

  if (
    Number.isNaN(startDate.getTime())
    || Number.isNaN(endDate.getTime())
    || startDate >= endDate
  ) return 'unknown';
  if (referenceDate >= endDate) return 'past';
  if (referenceDate >= startDate) return 'active';
  return 'upcoming';
};

export const getDisplayedIrrigationStatus = (currentStatus, lastLog, activeSchedule) => {
  const lastLogDate = new Date(lastLog?.created || 0);
  const manualStopDuringSchedule = activeSchedule
    && lastLog?.status === 'OFF'
    && lastLog?.source === 'MANUAL'
    && !Number.isNaN(lastLogDate.getTime())
    && lastLogDate >= activeSchedule.startDate;

  if (activeSchedule && !manualStopDuringSchedule) return 'ON';
  if (manualStopDuringSchedule) return 'OFF';
  if (lastLog?.status === 'OFF' && lastLog?.source === 'AUTOMATIC') return 'OFF';
  return currentStatus || 'OFF';
};

// Une los registros ON/OFF en riegos. Sin zonas se usan los registros del cultivo completo (sin zoneId).
// Con zonas (zoneFlows = Map zoneId → L/min) cada válvula es un riego propio, con su caudal.
const pairSessions = (records, now, extra = () => ({})) => {
  const orderedRecords = [...records]
    .filter((record) => record.status === 'ON' || record.status === 'OFF')
    .sort((first, second) => new Date(first.created) - new Date(second.created));
  const sessions = [];
  let openSession = null;

  orderedRecords.forEach((record) => {
    const timestamp = new Date(record.created);
    if (Number.isNaN(timestamp.getTime())) return;

    if (record.status === 'ON' && !openSession) {
      openSession = { ...record, activationDate: timestamp };
      return;
    }

    if (record.status === 'OFF' && openSession) {
      sessions.push({
        id: `${openSession.id}-${record.id}`,
        activationDate: openSession.activationDate,
        closingDate: timestamp,
        durationMs: Math.max(0, timestamp - openSession.activationDate),
        source: openSession.source,
        active: false,
        ...extra(openSession),
      });
      openSession = null;
    }
  });

  if (openSession) {
    sessions.push({
      id: openSession.id,
      activationDate: openSession.activationDate,
      closingDate: null,
      durationMs: Math.max(0, now - openSession.activationDate),
      source: openSession.source,
      active: true,
      ...extra(openSession),
    });
  }

  return sessions;
};

export const buildIrrigationSessions = (records, now = new Date(), zoneFlows = null) => {
  if (!(zoneFlows instanceof Map) || zoneFlows.size === 0) {
    return pairSessions(records.filter((record) => !record.zoneId), now);
  }
  const byZone = new Map();
  records.filter((record) => record.zoneId && zoneFlows.has(record.zoneId)).forEach((record) => {
    if (!byZone.has(record.zoneId)) byZone.set(record.zoneId, []);
    byZone.get(record.zoneId).push(record);
  });
  const sessions = [];
  byZone.forEach((zoneRecords, zoneId) => {
    sessions.push(...pairSessions(zoneRecords, now, () => ({ zoneId, flowLpm: zoneFlows.get(zoneId) || null })));
  });
  return sessions.sort((first, second) => first.activationDate - second.activationDate);
};

const formatLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const estimateDailyConsumption = (
  sessions,
  startDate,
  endDate,
  flowRateLitersPerMinute,
) => {
  const dailyLiters = new Map();
  const firstDay = new Date(startDate);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(endDate);
  lastDay.setHours(0, 0, 0, 0);
  const flowRate = Number(flowRateLitersPerMinute);
  const hasDefaultFlow = Number.isFinite(flowRate) && flowRate > 0;
  if (!hasDefaultFlow && !sessions.some((session) => Number(session.flowLpm) > 0)) return dailyLiters;

  for (const date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
    dailyLiters.set(formatLocalDateKey(date), 0);
  }

  sessions.forEach((session) => {
    const activationDate = new Date(session.activationDate);
    if (Number.isNaN(activationDate.getTime())) return;
    const closingDate = session.closingDate
      ? new Date(session.closingDate)
      : new Date(activationDate.getTime() + Math.max(0, Number(session.durationMs) || 0));
    if (Number.isNaN(closingDate.getTime()) || closingDate <= activationDate) return;
    for (const [key] of dailyLiters) {
      const [year, month, day] = key.split('-').map(Number);
      const dayStart = new Date(year, month - 1, day).getTime();
      const dayEnd = new Date(year, month - 1, day + 1).getTime();
      const overlapMs = Math.max(0, Math.min(closingDate.getTime(), dayEnd) - Math.max(activationDate.getTime(), dayStart));
      const sessionFlow = Number(session.flowLpm) > 0 ? Number(session.flowLpm) : flowRate;
      if (overlapMs > 0 && Number.isFinite(sessionFlow) && sessionFlow > 0) {
        dailyLiters.set(key, dailyLiters.get(key) + (overlapMs / 60000) * sessionFlow);
      }
    }
  });

  return dailyLiters;
};
