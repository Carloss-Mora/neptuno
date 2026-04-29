
import { useState, useEffect, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext';

export const useIrrigationSchedule = () => {
  const { currentUser } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedules = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const records = await pb.collection('user_settings').getList(1, 1, {
        filter: `userId = "${currentUser.id}"`,
        $autoCancel: false,
      });

      if (records.items.length > 0) {
        const settings = records.items[0];
        setSettingsId(settings.id);
        
        if (settings.irrigation_schedule_times) {
          try {
            const parsed = JSON.parse(settings.irrigation_schedule_times);
            setSchedules(Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            console.error('Error parsing schedules JSON', e);
            setSchedules([]);
          }
        } else {
          setSchedules([]);
        }
      } else {
        setSchedules([]);
        setSettingsId(null);
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
      const schedulesJson = JSON.stringify(newSchedules);
      
      if (settingsId) {
        await pb.collection('user_settings').update(settingsId, {
          irrigation_schedule_times: schedulesJson
        }, { $autoCancel: false });
      } else {
        const newSettings = await pb.collection('user_settings').create({
          userId: currentUser.id,
          irrigation_schedule_times: schedulesJson
        }, { $autoCancel: false });
        setSettingsId(newSettings.id);
      }
      
      setSchedules(newSchedules);
      return { success: true };
    } catch (err) {
      console.error('Error saving schedules:', err);
      const errMsg = err.message || 'No se pudo guardar el horario.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const addSchedule = async (days, time) => {
    const newSchedule = {
      id: crypto.randomUUID(),
      days,
      time
    };
    const newSchedules = [...schedules, newSchedule];
    return await saveSchedules(newSchedules);
  };

  const updateSchedule = async (id, days, time) => {
    const newSchedules = schedules.map(s => 
      s.id === id ? { ...s, days, time } : s
    );
    return await saveSchedules(newSchedules);
  };

  const deleteSchedule = async (id) => {
    const newSchedules = schedules.filter(s => s.id !== id);
    return await saveSchedules(newSchedules);
  };

  const getNextScheduledTime = () => {
    if (!schedules || schedules.length === 0) return null;
    
    const now = new Date();
    const dayMap = { 'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6 };
    let nextDate = null;

    schedules.forEach(schedule => {
      if (!schedule.days || !schedule.time) return;
      
      schedule.days.forEach(dayStr => {
        const targetDay = dayMap[dayStr];
        if (targetDay === undefined) return;

        const [hours, minutes] = schedule.time.split(':').map(Number);
        let candidate = new Date(now);
        candidate.setHours(hours, minutes, 0, 0);

        // If the day doesn't match or the time has already passed today, move to the next occurrence
        if (candidate.getDay() !== targetDay || candidate <= now) {
          let daysToAdd = (targetDay - candidate.getDay() + 7) % 7;
          if (daysToAdd === 0 && candidate <= now) {
            daysToAdd = 7;
          }
          candidate.setDate(candidate.getDate() + daysToAdd);
        }

        if (!nextDate || candidate < nextDate) {
          nextDate = candidate;
        }
      });
    });

    return nextDate;
  };

  return {
    schedules,
    loading,
    error,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    getNextScheduledTime,
    refreshSchedules: fetchSchedules
  };
};
