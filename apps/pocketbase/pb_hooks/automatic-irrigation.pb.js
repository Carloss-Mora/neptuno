/// <reference path="../pb_data/types.d.ts" />

cronAdd('automatic-irrigation', '* * * * *', () => {
  try {
    const formatDatePart = (value) => String(value).padStart(2, '0');
    const utcOffsetForSchedule = (schedule) => {
      const storedOffset = Number(schedule.utcOffsetMinutes);
      if (Number.isFinite(storedOffset) && storedOffset >= -720 && storedOffset <= 840) {
        return storedOffset;
      }

      const offsetsByTimeZone = {
        'UTC': 0,
        'Etc/UTC': 0,
        'America/Bogota': -300,
        'America/Lima': -300,
        'America/Quito': -300,
        'America/Panama': -300,
        'America/Mexico_City': -360,
        'America/Chicago': -360,
        'America/Denver': -420,
        'America/Los_Angeles': -480,
        'America/New_York': -300,
        'America/Toronto': -300,
        'Europe/London': 0,
        'Europe/Madrid': 60,
        'Europe/Paris': 60,
        'Europe/Berlin': 60,
        'Asia/Kolkata': 330,
        'Asia/Tokyo': 540,
        'Australia/Sydney': 600,
        'Pacific/Auckland': 720,
      };
      return offsetsByTimeZone[schedule.timeZone] ?? -300;
    };
    const timeToMinutes = (value) => {
      const [hours, minutes] = String(value || '').split(':').map(Number);
      if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
      }
      return hours * 60 + minutes;
    };
    const now = new Date();
    const settings = $app.findAllRecords('user_settings');
    const logsCollection = $app.findCollectionByNameOrId('irrigation_logs');

    for (const setting of settings) {
      let schedules = [];
      try {
        const parsed = JSON.parse(String(setting.get('irrigation_schedule_times') || '[]'));
        schedules = Array.isArray(parsed) ? parsed : [];
      } catch {
        schedules = [];
      }

      let activeScheduleStartTimestamp = null;
      const active = schedules.some((schedule) => {
        const scheduleDate = schedule.date || schedule.startDate;
        const startTime = schedule.startTime || schedule.time;
        const endTime = schedule.endTime;
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);
        const utcOffsetMinutes = utcOffsetForSchedule(schedule);
        const scheduleLocalNow = new Date(now.getTime() + utcOffsetMinutes * 60000);
        const currentDate = `${scheduleLocalNow.getUTCFullYear()}-${formatDatePart(scheduleLocalNow.getUTCMonth() + 1)}-${formatDatePart(scheduleLocalNow.getUTCDate())}`;
        const currentTime = scheduleLocalNow.getUTCHours() * 60 + scheduleLocalNow.getUTCMinutes();
        const isActive = scheduleDate === currentDate
          && startMinutes !== null
          && endMinutes !== null
          && startMinutes < endMinutes
          && startMinutes <= currentTime
          && currentTime < endMinutes;
        if (isActive) {
          const [year, month, day] = scheduleDate.split('-').map(Number);
          const startTimestamp = Date.UTC(
            year,
            month - 1,
            day,
            Math.floor(startMinutes / 60),
            startMinutes % 60,
          ) - utcOffsetMinutes * 60000;
          if (activeScheduleStartTimestamp === null || startTimestamp < activeScheduleStartTimestamp) {
            activeScheduleStartTimestamp = startTimestamp;
          }
        }
        return isActive;
      });

      const userId = setting.get('userId');
      if (!userId) continue;

      let latestLog = null;
      try {
        const latestLogs = $app.findRecordsByFilter(
          logsCollection,
          'userId = {:userId}',
          '-created',
          1,
          0,
          { userId },
        );
        latestLog = latestLogs.length > 0 ? latestLogs[0] : null;
      } catch {
        latestLog = null;
      }

      const desiredStatus = active ? 'ON' : 'OFF';
      const latestStatus = latestLog?.get('status');
      const latestSource = latestLog?.get('source');

      if (active) {
        const latestLogDate = latestLog ? new Date(latestLog.get('created')) : null;
        const manualStopDuringSchedule = latestStatus === 'OFF'
          && latestSource === 'MANUAL'
          && activeScheduleStartTimestamp !== null
          && latestLogDate
          && !Number.isNaN(latestLogDate.getTime())
          && latestLogDate.getTime() >= activeScheduleStartTimestamp;
        if (latestStatus === 'ON' || manualStopDuringSchedule) continue;
      } else if (latestStatus !== 'ON' || latestSource !== 'AUTOMATIC') {
        continue;
      }

      $app.save(new Record(logsCollection, {
        userId,
        status: desiredStatus,
        source: 'AUTOMATIC',
      }));
    }
  } catch (error) {
    console.error('Automatic irrigation scheduler failed:', error);
  }
});
