/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/neptuno/ingest', (e) => {
  const request = e.requestInfo();
  const body = request.body || {};
  const deviceKey = String(
    request.headers['x_device_key']
    || e.request.header.get('X-Device-Key')
    || '',
  );
  if (!deviceKey || deviceKey.length > 256) {
    throw new UnauthorizedError('Clave de dispositivo no válida.');
  }

  const keyHash = $security.sha256(deviceKey);
  const matches = $app.findRecordsByFilter(
    'devices',
    'key_hash = {:keyHash}',
    '',
    1,
    0,
    { keyHash },
  );
  const device = matches.length > 0 ? matches[0] : null;
  if (!device || !$security.equal(keyHash, String(device.get('key_hash') || ''))) {
    throw new UnauthorizedError('Clave de dispositivo no válida.');
  }

  if (device.get('is_simulated') === true) {
    throw new ForbiddenError('Los dispositivos simulados no aceptan lecturas externas.');
  }

  const soilHumidity = Number(body.soil_humidity);
  const temperature = Number(body.temperature);
  const waterLevel = Number(body.water_level);
  const isDemo = body.demo === true;
  if (
    !Number.isFinite(soilHumidity) || soilHumidity < 0 || soilHumidity > 100
    || !Number.isFinite(temperature) || temperature < -10 || temperature > 60
    || !Number.isFinite(waterLevel) || waterLevel < 0 || waterLevel > 100
  ) {
    throw new BadRequestError('Lectura fuera de los rangos permitidos.');
  }

  // Opcional: valores por sensor { "<id del sensor>": número }. Sin esto, cada lectura general
  // actualiza los sensores del mismo tipo del cultivo.
  let sensorReadings = null;
  if (body.sensor_readings && typeof body.sensor_readings === 'object' && !Array.isArray(body.sensor_readings)) {
    sensorReadings = {};
    for (const key of Object.keys(body.sensor_readings).slice(0, 24)) {
      const value = Number(body.sensor_readings[key]);
      if (!Number.isFinite(value) || value < -10 || value > 100) {
        throw new BadRequestError('Lectura de sensor fuera de los rangos permitidos.');
      }
      sensorReadings[key] = value;
    }
  }

  const now = new Date();
  const lastIngest = device.get('last_ingest_at') ? new Date(device.get('last_ingest_at')) : null;
  const intervalSeconds = Math.max(1, Number(device.get('interval_seconds')) || 15);
  if (lastIngest && !Number.isNaN(lastIngest.getTime()) && now.getTime() - lastIngest.getTime() < intervalSeconds * 500) {
    throw new TooManyRequestsError(`Espera ${intervalSeconds} segundos entre lecturas.`);
  }

  const crop = $app.findRecordById('crops', device.get('cropId'));
  if (String(device.get('userId')) !== String(crop.get('userId'))) {
    console.error(`Device ${device.id} user/crop ownership mismatch.`);
    throw new ForbiddenError('El dispositivo no pertenece al usuario del cultivo.');
  }

  const core = require(`${__hooks}/irrigation-core.js`);
  const { desiredState } = core.processReading(
    $app,
    device,
    crop,
    { soilHumidity, temperature, waterLevel },
    { isDemo, nowMs: now.getTime(), sensorReadings },
  );

  return e.json(200, { irrigation: desiredState });
});
