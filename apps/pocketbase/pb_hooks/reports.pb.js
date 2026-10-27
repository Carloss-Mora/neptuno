/// <reference path="../pb_data/types.d.ts" />

// Lecturas de sensores agrupadas por hora para los reportes (evita bajar miles de lecturas al navegador).
// GET /api/neptuno/reports/readings?cropId=...&from=ISO&to=ISO[&include_demo=1]  (máximo 400 días; sin include_demo, solo datos reales)
routerAdd('GET', '/api/neptuno/reports/readings', (e) => {
  const info = e.requestInfo();
  const cropId = String(info.query.cropId || '');
  const from = new Date(String(info.query.from || ''));
  const to = new Date(String(info.query.to || ''));
  if (!cropId || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    throw new BadRequestError('Indica el cultivo y un periodo válido (from, to).');
  }
  if (to.getTime() - from.getTime() > 400 * 24 * 60 * 60 * 1000) {
    throw new BadRequestError('El periodo máximo es de 400 días.');
  }
  const includeDemo = String(info.query.include_demo || '') === '1';
  const crop = $app.findRecordById('crops', cropId);
  if (String(crop.get('userId')) !== String(e.auth.id)) {
    throw new ForbiddenError('El cultivo no pertenece al usuario autenticado.');
  }

  // PocketBase guarda las fechas como "2026-10-27 02:43:17.961Z": los 13 primeros caracteres son la hora.
  const toKey = (date) => date.toISOString().replace('T', ' ').slice(0, 13);
  const buckets = new Map();
  const add = (hour, humidity, temperature, water, samples) => {
    const bucket = buckets.get(hour) || { hour, h: 0, t: 0, w: 0, n: 0 };
    bucket.h += humidity * samples;
    bucket.t += temperature * samples;
    bucket.w += water * samples;
    bucket.n += samples;
    buckets.set(hour, bucket);
  };

  const raw = arrayOf(new DynamicModel({ hour: '', h: 0.5, t: 0.5, w: 0.5, n: 0 }));
  $app.db().newQuery(
    `SELECT substr(created, 1, 13) AS hour, AVG(soil_humidity) AS h, AVG(temperature) AS t,
            AVG(water_level) AS w, COUNT(*) AS n
     FROM sensor_readings
     WHERE cropId = {:cropId} AND (is_demo IS NULL OR is_demo = 0 OR {:includeDemo} = 1) AND created >= {:from} AND created <= {:to}
     GROUP BY substr(created, 1, 13)`,
  ).bind({
    cropId,
    includeDemo: includeDemo ? 1 : 0,
    from: from.toISOString().replace('T', ' '),
    to: to.toISOString().replace('T', ' '),
  }).all(raw);
  for (const row of raw) add(row.hour, row.h, row.t, row.w, row.n);

  // Las lecturas antiguas ya resumidas por hora (ver sensor-retention.pb.js).
  const summarized = $app.findRecordsByFilter(
    'sensor_readings_hourly',
    `cropId = {:cropId} && ${includeDemo ? '' : '(is_demo = false || is_demo = null) && '}hour_start >= {:from} && hour_start <= {:to}`,
    'hour_start',
    0,
    0,
    { cropId, from: from.toISOString(), to: to.toISOString() },
  );
  for (const record of summarized) {
    add(
      toKey(new Date(record.get('hour_start'))),
      Number(record.get('humidity_avg')),
      Number(record.get('temperature_avg')),
      Number(record.get('water_level_avg')),
      Number(record.get('sample_count')) || 1,
    );
  }

  const hours = Array.from(buckets.values())
    .sort((a, b) => (a.hour < b.hour ? -1 : 1))
    .map((bucket) => ({
      hour: `${bucket.hour.replace(' ', 'T')}:00:00.000Z`,
      humidity: bucket.h / bucket.n,
      temperature: bucket.t / bucket.n,
      water_level: bucket.w / bucket.n,
      samples: bucket.n,
    }));
  return e.json(200, { hours });
}, $apis.requireAuth());
