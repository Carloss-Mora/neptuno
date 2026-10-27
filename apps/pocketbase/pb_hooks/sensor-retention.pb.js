/// <reference path="../pb_data/types.d.ts" />

// Cada usuario puede elegir cuántos días conservar las lecturas detalladas (Ajustes; 30 por defecto).
// Pasado ese plazo se resumen por hora y se borran las lecturas detalladas.
cronAdd('sensor-reading-retention', '0 2 * * *', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const retentionByUser = new Map();
  let shortest = 30;
  for (const setting of $app.findRecordsByFilter('user_settings', 'retention_days > 0', '', 0, 0)) {
    const days = Number(setting.get('retention_days'));
    retentionByUser.set(String(setting.get('userId')), days);
    if (days < shortest) shortest = days;
  }
  const cutoff = new Date(Date.now() - shortest * DAY_MS).toISOString();
  const oldReadings = $app.findRecordsByFilter(
    'sensor_readings',
    'created < {:cutoff}',
    'created',
    0,
    0,
    { cutoff },
  );
  const groups = new Map();

  for (const reading of oldReadings) {
    const createdAt = new Date(reading.get('created'));
    if (Number.isNaN(createdAt.getTime())) continue;
    const keepDays = retentionByUser.get(String(reading.get('userId'))) || 30;
    if (createdAt.getTime() > Date.now() - keepDays * DAY_MS) continue;
    createdAt.setUTCMinutes(0, 0, 0);
    const hourStart = createdAt.toISOString();
    const key = `${reading.get('cropId')}:${hourStart}`;
    const group = groups.get(key) || {
      cropId: reading.get('cropId'),
      userId: reading.get('userId'),
      hourStart,
      humidityTotal: 0,
      temperatureTotal: 0,
      waterLevelTotal: 0,
      count: 0,
      isDemo: false,
      readingIds: [],
    };
    group.humidityTotal += Number(reading.get('soil_humidity'));
    group.temperatureTotal += Number(reading.get('temperature'));
    group.waterLevelTotal += Number(reading.get('water_level'));
    group.count += 1;
    group.isDemo = group.isDemo || reading.get('is_demo') === true;
    group.readingIds.push(reading.id);
    groups.set(key, group);
  }

  const hourlyCollection = $app.findCollectionByNameOrId('sensor_readings_hourly');
  for (const group of groups.values()) {
    const existing = $app.findRecordsByFilter(
      hourlyCollection,
      'cropId = {:cropId} && hour_start = {:hourStart}',
      '',
      1,
      0,
      { cropId: group.cropId, hourStart: group.hourStart },
    );
    const previous = existing[0] || null;
    const previousCount = previous ? Number(previous.get('sample_count')) : 0;
    const totalCount = previousCount + group.count;
    const mergedAverage = (field, total) => previous
      ? ((Number(previous.get(field)) * previousCount) + total) / totalCount
      : total / group.count;
    const hourly = previous || new Record(hourlyCollection);
    hourly.set('userId', group.userId);
    hourly.set('cropId', group.cropId);
    hourly.set('hour_start', group.hourStart);
    hourly.set('humidity_avg', mergedAverage('humidity_avg', group.humidityTotal));
    hourly.set('temperature_avg', mergedAverage('temperature_avg', group.temperatureTotal));
    hourly.set('water_level_avg', mergedAverage('water_level_avg', group.waterLevelTotal));
    hourly.set('sample_count', totalCount);
    hourly.set('is_demo', group.isDemo || (previous && previous.get('is_demo') === true));
    $app.save(hourly);
    for (const id of group.readingIds) $app.delete($app.findRecordById('sensor_readings', id));
  }
});
