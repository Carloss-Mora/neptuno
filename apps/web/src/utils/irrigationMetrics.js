export const LITERS_PER_SQUARE_METER_PER_SESSION = 0.1;
export const LITERS_PER_SQUARE_METER_LABEL = LITERS_PER_SQUARE_METER_PER_SESSION
  .toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
    if (!dateValue || !startTime || !endTime) continue;

    const [year, month, day] = String(dateValue).split('-').map(Number);
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
  if (!startTime) return 'unknown';
  const scheduleDate = dateValue || formatLocalDateKey(referenceDate);

  const [year, month, day] = String(scheduleDate).split('-').map(Number);
  const [startHours, startMinutes] = String(startTime).split(':').map(Number);
  const startDate = new Date(year, month - 1, day, startHours, startMinutes);
  const [endHours, endMinutes] = String(endTime || '').split(':').map(Number);
  const endDate = endTime
    ? new Date(year, month - 1, day, endHours, endMinutes)
    : startDate;

  if (
    Number.isNaN(startDate.getTime())
    || Number.isNaN(endDate.getTime())
    || (endTime && startDate >= endDate)
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

export const buildIrrigationSessions = (records, now = new Date()) => {
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
    });
  }

  return sessions;
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
  cultivatedAreaM2,
  litersPerSquareMeter = LITERS_PER_SQUARE_METER_PER_SESSION,
) => {
  const dailyLiters = new Map();
  const firstDay = new Date(startDate);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(endDate);
  lastDay.setHours(0, 0, 0, 0);
  const area = Number(cultivatedAreaM2);
  const litersPerSession = Number.isFinite(area) && area > 0
    ? area * litersPerSquareMeter
    : 0;

  for (const date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
    dailyLiters.set(formatLocalDateKey(date), 0);
  }

  sessions.forEach((session) => {
    const activationDate = new Date(session.activationDate);
    if (Number.isNaN(activationDate.getTime())) return;
    const key = formatLocalDateKey(activationDate);
    if (dailyLiters.has(key)) {
      dailyLiters.set(key, dailyLiters.get(key) + litersPerSession);
    }
  });

  return dailyLiters;
};
