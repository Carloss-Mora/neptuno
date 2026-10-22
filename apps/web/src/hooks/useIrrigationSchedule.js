
import { useState, useEffect, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext';

const normalizeScheduleEntries = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (typeof value === 'object') {
    return Array.isArray(value.items) ? value.items : [];
  }

  return [];
};

const getUserSettings = async (userId) => {
  const records = await pb.collection('user_settings').getList(1, 1, {
    filter: `userId = "${userId}"`,
    sort: '-updated',
    $autoCancel: false,
  });

  return records.items[0] || null;
};

const createScheduleId = () => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') {
    return randomUUID.call(globalThis.crypto);
  }

  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const useIrrigationSchedule = () => {
  const { currentUser } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedules = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);

      const settings = await getUserSettings(currentUser.id);
      if (settings) {
        if (settings.irrigation_schedule_times) {
          try {
            const parsed = normalizeScheduleEntries(settings.irrigation_schedule_times);
            setSchedules(parsed);
          } catch (e) {
            console.error('Error parsing schedules JSON', e);
            setSchedules([]);
          }
        } else {
          setSchedules([]);
        }
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError(err.message || 'Error al cargar los horarios.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const saveSchedules = async (newSchedules) => {
    if (!currentUser) return { success: false, error: 'Usuario no autenticado' };

    try {
      setError(null);
      const safeSchedules = Array.isArray(newSchedules) ? newSchedules : [];
      const schedulesJson = JSON.stringify(safeSchedules);
      const settings = await getUserSettings(currentUser.id);

      if (settings) {
        await pb.collection('user_settings').update(settings.id, {
          userId: currentUser.id,
          irrigation_schedule_times: schedulesJson,
        }, { $autoCancel: false });
      } else {
        await pb.collection('user_settings').create({
          userId: currentUser.id,
          irrigation_schedule_times: schedulesJson,
        }, { $autoCancel: false });
      }

      setSchedules(safeSchedules);
      return { success: true };
    } catch (err) {
      console.error('Error saving schedules:', err);
      const fieldErrors = Object.values(err?.data?.data || {})
        .map((fieldError) => fieldError?.message)
        .filter(Boolean);
      const errMsg = fieldErrors.join(' ')
        || err?.data?.message
        || err?.message
        || 'No se pudo guardar el horario.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const addSchedule = async (startTime, endTime, date) => {
    const normalizedSchedules = Array.isArray(schedules) ? schedules : [];
    const newSchedule = {
      id: createScheduleId(),
      date,
      startTime,
      endTime,
      time: startTime,
      days: [],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota',
      utcOffsetMinutes: -new Date(`${date}T${startTime}:00`).getTimezoneOffset(),
    };
    const newSchedules = [...normalizedSchedules, newSchedule];
    return await saveSchedules(newSchedules);
  };

  const updateSchedule = async (id, startTime, endTime, date) => {
    const normalizedSchedules = Array.isArray(schedules) ? schedules : [];
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
    const utcOffsetMinutes = -new Date(`${date}T${startTime}:00`).getTimezoneOffset();
    const newSchedules = normalizedSchedules.map((schedule) =>
      schedule.id === id
        ? { ...schedule, date, startTime, endTime, time: startTime, days: [], timeZone, utcOffsetMinutes }
        : schedule
    );
    return await saveSchedules(newSchedules);
  };

  const deleteSchedule = async (id) => {
    const newSchedules = schedules.filter((schedule) => schedule.id !== id);
    return await saveSchedules(newSchedules);
  };

  const getScheduleStatus = (referenceDate = new Date()) => {
    const now = referenceDate;
    let activeSchedule = null;
    let nextSchedule = null;

    schedules.forEach((schedule) => {
      const dateValue = schedule.date || schedule.startDate || schedule.endDate;
      const startTime = schedule.startTime || schedule.time;
      const endTime = schedule.endTime;

      if (!dateValue || !startTime || !endTime) return;

      const [year, month, day] = String(dateValue).split('-').map(Number);
      const [startHours, startMinutes] = String(startTime).split(':').map(Number);
      const [endHours, endMinutes] = String(endTime).split(':').map(Number);
      const startDate = new Date(year, month - 1, day, startHours, startMinutes, 0, 0);
      const endDate = new Date(year, month - 1, day, endHours, endMinutes, 0, 0);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;

      if (startDate <= now && now < endDate) {
        if (!activeSchedule || endDate < activeSchedule.endDate) {
          activeSchedule = { ...schedule, startDate, endDate };
        }
        return;
      }

      if (startDate > now && (!nextSchedule || startDate < nextSchedule.startDate)) {
        nextSchedule = { ...schedule, startDate, endDate };
      }
    });

    return { activeSchedule, nextSchedule };
  };

  const getNextScheduledTime = () => {
    return getScheduleStatus().nextSchedule?.startDate || null;
  };

  return {
    schedules,
    loading,
    error,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    getNextScheduledTime,
    getScheduleStatus,
    refreshSchedules: fetchSchedules,
  };
};
