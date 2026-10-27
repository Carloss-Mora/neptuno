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

  // Opcional: caudal medido en L/min por un sensor de flujo.
  let flowLpm = NaN;
  if (body.flow_lpm !== undefined && body.flow_lpm !== null && body.flow_lpm !== '') {
    flowLpm = Number(body.flow_lpm);
    if (!Number.isFinite(flowLpm) || flowLpm < 0 || flowLpm > 500) {
      throw new BadRequestError('El caudal medido debe estar entre 0 y 500 L/min.');
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
  const { desiredState, zones } = core.processReading(
    $app,
    device,
    crop,
    { soilHumidity, temperature, waterLevel },
    { isDemo, nowMs: now.getTime(), sensorReadings, flowLpm },
  );

  // zones: estado de cada válvula (vacío si el cultivo no usa zonas).
  // hold_seconds: cuánto puede seguir el controlador sin contacto antes de cerrar las válvulas.
  // config: umbrales del cultivo para que el controlador siga regando solo (modo automático) si pierde internet.
  const isAuto = crop.get('control_mode') === 'AUTO';
  const positive = (field) => (Number(crop.get(field)) > 0 ? Number(crop.get(field)) : 0);
  return e.json(200, {
    irrigation: desiredState,
    zones,
    hold_seconds: Math.max(60, intervalSeconds * 3),
    config: {
      control_mode: String(crop.get('control_mode') || 'MANUAL'),
      ...(isAuto ? {
        humidity_min: positive('humidity_min'),
        humidity_max: positive('humidity_max'),
        max_irrigation_minutes: positive('max_irrigation_minutes'),
        min_rest_minutes: Number(crop.get('min_rest_minutes')) || 0,
        pulse_on_minutes: positive('pulse_on_minutes'),
        pulse_off_minutes: positive('pulse_off_minutes'),
      } : {}),
    },
  });
});
