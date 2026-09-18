/// <reference path="../pb_data/types.d.ts" />

cronAdd('automatic-irrigation', '* * * * *', () => {
  try {
    const formatDatePart = (value) => String(value).padStart(2, '0');
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

      const timeZone = schedules.find((schedule) => schedule.timeZone)?.timeZone || 'America/Bogota';
      let currentDate;
      let currentTime;
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).formatToParts(now).reduce((result, part) => {
          result[part.type] = part.value;
          return result;
        }, {});
        currentDate = `${parts.year}-${parts.month}-${parts.day}`;
        currentTime = timeToMinutes(`${parts.hour}:${parts.minute}`);
      } catch {
        currentDate = `${now.getFullYear()}-${formatDatePart(now.getMonth() + 1)}-${formatDatePart(now.getDate())}`;
        currentTime = now.getHours() * 60 + now.getMinutes();
      }

      const active = schedules.some((schedule) => {
        const scheduleDate = schedule.date || schedule.startDate;
        const startTime = schedule.startTime || schedule.time;
        const endTime = schedule.endTime;
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);

        return scheduleDate === currentDate
          && startMinutes !== null
          && endMinutes !== null
          && currentTime !== null
          && startMinutes < endMinutes
          && startMinutes <= currentTime
          && currentTime < endMinutes;
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
        if (latestStatus === 'ON' || (latestStatus === 'OFF' && latestSource === 'MANUAL')) continue;
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
