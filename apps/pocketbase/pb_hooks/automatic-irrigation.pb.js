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
    const weekdayNumber = (value) => {
      if (Number.isInteger(value) && value >= 0 && value <= 6) return value;
      const day = String(value).toLowerCase();
      const days = {
        sun: 0, sunday: 0, domingo: 0,
        mon: 1, monday: 1, lunes: 1,
        tue: 2, tuesday: 2, martes: 2,
        wed: 3, wednesday: 3, miercoles: 3, miércoles: 3,
        thu: 4, thursday: 4, jueves: 4,
        fri: 5, friday: 5, viernes: 5,
        sat: 6, saturday: 6, sabado: 6, sábado: 6,
      };
      return days[day] ?? null;
    };
    const now = new Date();
    const crops = $app.findAllRecords('crops');
    const devices = $app.findAllRecords('devices');
    const invalidCropIds = new Set();
    for (const device of devices) {
      try {
        const deviceCrop = $app.findRecordById('crops', device.get('cropId'));
        if (String(device.get('userId')) !== String(deviceCrop.get('userId'))) {
          invalidCropIds.add(deviceCrop.id);
          console.error(`Device ${device.id} user/crop ownership mismatch; skipping irrigation for crop ${deviceCrop.id}.`);
        }
      } catch (error) {
        console.error(`Could not validate ownership for device ${device.id}:`, error);
      }
    }
    const schedulesCollection = $app.findCollectionByNameOrId('irrigation_schedules');
    const logsCollection = $app.findCollectionByNameOrId('irrigation_logs');

    for (const crop of crops) {
      const cropId = crop.id;
      const userId = crop.get('userId');
      if (!userId || invalidCropIds.has(cropId)) continue;

      let schedules = [];
      try {
        schedules = $app.findRecordsByFilter(
          schedulesCollection,
          'cropId = {:cropId} && userId = {:userId}',
          'startTime',
          0,
          0,
          { cropId, userId },
        );
      } catch (error) {
        console.error(`Could not load schedules for crop ${cropId}:`, error);
        continue;
      }

      let activeScheduleStartTimestamp = null;
      const active = crop.get('control_mode') === 'SCHEDULE' && schedules.some((schedule) => {
        const startMinutes = timeToMinutes(schedule.get('startTime'));
        const endMinutes = timeToMinutes(schedule.get('endTime'));
        if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) return false;

        const utcOffsetMinutes = Number(schedule.get('utcOffsetMinutes') || 0);
        const localNow = new Date(now.getTime() + utcOffsetMinutes * 60000);
        const currentDate = `${localNow.getUTCFullYear()}-${formatDatePart(localNow.getUTCMonth() + 1)}-${formatDatePart(localNow.getUTCDate())}`;
        const currentTime = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
        const recurrence = schedule.get('recurrence') || 'ONCE';
        let occursToday = schedule.get('date') === currentDate;

        if (recurrence === 'DAILY') {
          occursToday = true;
        } else if (recurrence === 'WEEKLY') {
          let days = schedule.get('days');
          if (typeof days === 'string') {
            try {
              days = JSON.parse(days);
            } catch {
              days = [];
            }
          }
          const currentWeekday = localNow.getUTCDay();
          occursToday = Array.isArray(days) && days.some((day) => weekdayNumber(day) === currentWeekday);
        }

        const isActive = occursToday
          && startMinutes <= currentTime
          && currentTime < endMinutes;
        if (isActive) {
          const [year, month, day] = currentDate.split('-').map(Number);
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

      let latestLog = null;
      try {
        const latestLogs = $app.findRecordsByFilter(
          logsCollection,
          'cropId = {:cropId}',
          '-created',
          1,
          0,
          { cropId },
        );
        latestLog = latestLogs.length > 0 ? latestLogs[0] : null;
      } catch (error) {
        console.error(`Could not load irrigation status for crop ${cropId}:`, error);
        continue;
      }

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
      } else if (latestStatus !== 'ON' || latestSource !== 'SCHEDULE') {
        continue;
      }

      $app.save(new Record(logsCollection, {
        userId,
        cropId,
        status: active ? 'ON' : 'OFF',
        source: 'SCHEDULE',
      }));
    }
  } catch (error) {
    console.error('Automatic irrigation scheduler failed:', error);
  }
});
