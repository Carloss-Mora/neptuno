import { useState, useEffect, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCrop } from '@/contexts/CropContext';

const getScheduleError = (error) => {
  const fieldErrors = Object.values(error?.data?.data || {})
    .map((fieldError) => fieldError?.message)
    .filter(Boolean);
  return fieldErrors.join(' ')
    || error?.data?.message
    || error?.message
    || 'No se pudo guardar el horario.';
};

export const useIrrigationSchedule = () => {
  const { currentUser } = useAuth();
  const { selectedCrop } = useCrop();
  const cropId = selectedCrop?.id || '';
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(Boolean(currentUser && cropId));
  const [error, setError] = useState(null);

  const fetchSchedules = useCallback(async () => {
    if (!currentUser || !cropId) {
      setSchedules([]);
      setLoading(false);
      setError(null);
      return [];
    }

    setLoading(true);
    setError(null);
    try {
      const records = await pb.collection('irrigation_schedules').getFullList({
        filter: `userId = "${currentUser.id}" && cropId = "${cropId}"`,
        sort: 'date,startTime',
        $autoCancel: false,
      });
      setSchedules(records);
      return records;
    } catch (fetchError) {
      console.error('Error fetching schedules:', fetchError);
      setError(fetchError.message || 'Error al cargar los horarios.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentUser, cropId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const addSchedule = async (startTime, endTime, date, recurrence = 'ONCE', days = []) => {
    if (!currentUser || !cropId) return { success: false, error: 'Selecciona un cultivo antes de programar el riego.' };
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
      const scheduledDate = recurrence === 'ONCE' ? date : '';
      const record = await pb.collection('irrigation_schedules').create({
        userId: currentUser.id,
        cropId,
        date: scheduledDate,
        startTime,
        endTime,
        timeZone,
        utcOffsetMinutes: -new Date(`${scheduledDate || new Date().toISOString().slice(0, 10)}T${startTime}:00`).getTimezoneOffset(),
        days: recurrence === 'WEEKLY' ? days : [],
        recurrence,
      }, { $autoCancel: false });
      setSchedules((existing) => [...existing, record]);
      return { success: true, schedule: record };
    } catch (saveError) {
      console.error('Error creating irrigation schedule:', saveError);
      const message = getScheduleError(saveError);
      setError(message);
      return { success: false, error: message };
    }
  };

  const updateSchedule = async (id, startTime, endTime, date, recurrence = 'ONCE', days = []) => {
    if (!currentUser || !cropId) return { success: false, error: 'Selecciona un cultivo antes de editar el horario.' };
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
      const record = await pb.collection('irrigation_schedules').update(id, {
        date: recurrence === 'ONCE' ? date : '',
        startTime,
        endTime,
        timeZone,
        utcOffsetMinutes: -new Date(`${(recurrence === 'ONCE' ? date : new Date().toISOString().slice(0, 10))}T${startTime}:00`).getTimezoneOffset(),
        days: recurrence === 'WEEKLY' ? days : [],
        recurrence,
      }, { $autoCancel: false });
      setSchedules((existing) => existing.map((schedule) => schedule.id === id ? record : schedule));
      return { success: true, schedule: record };
    } catch (saveError) {
      console.error('Error updating irrigation schedule:', saveError);
      const message = getScheduleError(saveError);
      setError(message);
      return { success: false, error: message };
    }
  };

  const deleteSchedule = async (id) => {
    try {
      await pb.collection('irrigation_schedules').delete(id, { $autoCancel: false });
      setSchedules((existing) => existing.filter((schedule) => schedule.id !== id));
      return { success: true };
    } catch (deleteError) {
      console.error('Error deleting irrigation schedule:', deleteError);
      const message = getScheduleError(deleteError);
      setError(message);
      return { success: false, error: message };
    }
  };

  const getScheduleStatus = (referenceDate = new Date()) => {
    const now = referenceDate;
    let activeSchedule = null;
    let nextSchedule = null;

    schedules.forEach((schedule) => {
      const dateValue = schedule.date || schedule.startDate;
      const startTime = schedule.startTime || schedule.time;
      const endTime = schedule.endTime;
      const recurrence = schedule.recurrence || 'ONCE';
      if (!startTime || !endTime || (recurrence === 'ONCE' && !dateValue)) return;
      const [startHours, startMinutes] = String(startTime).split(':').map(Number);
      const [endHours, endMinutes] = String(endTime).split(':').map(Number);
      if (![startHours, startMinutes, endHours, endMinutes].every(Number.isFinite)) return;

      let nextOccurrence = null;
      const days = Array.isArray(schedule.days) ? schedule.days : [];
      const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (recurrence === 'ONCE') {
        const [year, month, day] = String(dateValue).split('-').map(Number);
        const startDate = new Date(year, month - 1, day, startHours, startMinutes, 0, 0);
        const endDate = new Date(year, month - 1, day, endHours, endMinutes, 0, 0);
        if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate > now) {
          nextOccurrence = { ...schedule, startDate, endDate };
        }
      }
      for (let offset = 0; offset <= 7; offset += 1) {
        if (recurrence === 'ONCE' || nextOccurrence) break;
        const occurrenceDate = new Date(now);
        occurrenceDate.setDate(now.getDate() + offset);
        if (recurrence === 'ONCE' && localDateKey(occurrenceDate) !== dateValue) continue;
        if (recurrence === 'WEEKLY' && !days.some((day) => Number(day) === occurrenceDate.getDay())) continue;
        const startDate = new Date(occurrenceDate.getFullYear(), occurrenceDate.getMonth(), occurrenceDate.getDate(), startHours, startMinutes, 0, 0);
        const endDate = new Date(occurrenceDate.getFullYear(), occurrenceDate.getMonth(), occurrenceDate.getDate(), endHours, endMinutes, 0, 0);
        if (startDate >= endDate || endDate <= now) continue;
        nextOccurrence = { ...schedule, startDate, endDate };
        break;
      }
      if (!nextOccurrence) return;
      if (nextOccurrence.startDate <= now && now < nextOccurrence.endDate) {
        if (!activeSchedule || nextOccurrence.endDate < activeSchedule.endDate) activeSchedule = nextOccurrence;
      } else if (!nextSchedule || nextOccurrence.startDate < nextSchedule.startDate) {
        nextSchedule = nextOccurrence;
      }
    });

    return { activeSchedule, nextSchedule };
  };

  const getNextScheduledTime = () => getScheduleStatus().nextSchedule?.startDate || null;

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
