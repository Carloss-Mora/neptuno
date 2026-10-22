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

  const readings = $app.findCollectionByNameOrId('sensor_readings');
  $app.save(new Record(readings, {
    userId: device.get('userId'),
    cropId: device.get('cropId'),
    deviceId: device.id,
    soil_humidity: soilHumidity,
    temperature,
    water_level: waterLevel,
    is_demo: isDemo,
  }));

  let desiredState = String(device.get('desired_state') || 'OFF');
  const latestLogs = $app.findRecordsByFilter(
    'irrigation_logs',
    'cropId = {:cropId}',
    '-created',
    1,
    0,
    { cropId: device.get('cropId') },
  );
  const latestLog = latestLogs[0] || null;
  if (latestLog && (latestLog.get('status') === 'ON' || latestLog.get('status') === 'OFF')) {
    desiredState = latestLog.get('status');
  }

  if (crop.get('control_mode') === 'AUTO') {
    const policy = require(`${__hooks}/irrigation-policy.js`);
    const stoppedLogs = $app.findRecordsByFilter(
      'irrigation_logs',
      'cropId = {:cropId} && status = "OFF"',
      '-created',
      1,
      0,
      { cropId: device.get('cropId') },
    );
    const overrideUntil = crop.get('manual_override_until')
      ? new Date(crop.get('manual_override_until')).getTime()
      : 0;
    const decision = policy.decide({
      humidity: soilHumidity,
      humidityMin: crop.get('humidity_min') == null ? NaN : Number(crop.get('humidity_min')),
      humidityMax: crop.get('humidity_max') == null ? NaN : Number(crop.get('humidity_max')),
      waterLevel: waterLevel,
      currentState: desiredState,
      nowMs: now.getTime(),
      activeSinceMs: desiredState === 'ON' && latestLog ? new Date(latestLog.get('created')).getTime() : NaN,
      lastStoppedAtMs: stoppedLogs[0] ? new Date(stoppedLogs[0].get('created')).getTime() : NaN,
      maxContinuousMs: Number(crop.get('max_irrigation_minutes')) * 60000,
      minRestMs: Number(crop.get('min_rest_minutes')) * 60000,
      manualOverrideUntilMs: overrideUntil,
    });

    if (decision.state !== desiredState) {
      $app.save(new Record($app.findCollectionByNameOrId('irrigation_logs'), {
        userId: device.get('userId'),
        cropId: device.get('cropId'),
        status: decision.state,
        source: 'THRESHOLD',
        deviceId: device.id,
        is_demo: isDemo,
      }));
      desiredState = decision.state;
    }
  }

  device.set('last_seen', now.toISOString());
  device.set('last_ingest_at', now.toISOString());
  device.set('desired_state', desiredState);
  device.set('is_demo', isDemo);
  const humidityMinimum = crop.get('humidity_min');
  const waterMinimum = crop.get('alert_water_min');
  const maximumTemperature = crop.get('alert_temp_max');
  const alertCode = waterMinimum != null && waterLevel < Number(waterMinimum)
    ? 'water_low'
    : humidityMinimum != null && soilHumidity < Number(humidityMinimum)
      ? 'humidity_low'
      : maximumTemperature != null && temperature > Number(maximumTemperature)
        ? 'temperature_high'
      : '';
  const previousAlertCode = String(device.get('last_alert_code') || '');
  if (alertCode !== previousAlertCode) {
    device.set('last_alert_code', alertCode);
    if (alertCode) {
      try {
        const message = alertCode === 'water_low'
          ? `El nivel de agua está por debajo del mínimo configurado (${waterMinimum}%).`
          : alertCode === 'humidity_low'
            ? `La humedad del cultivo está por debajo del mínimo configurado (${humidityMinimum}%).`
            : `La temperatura del cultivo superó el máximo configurado (${maximumTemperature} °C).`;
        const queueNotification = require(`${__hooks}/notification-queue.js`);
        queueNotification($app, device.get('userId'), crop.id, 'alert', 'Alerta del cultivo en Neptuno', message);
        device.set('last_alert_sent_at', now.toISOString());
      } catch (queueError) {
        console.error(`Could not queue an alert for device ${device.id}:`, queueError);
      }
    }
  }
  $app.save(device);

  return e.json(200, { irrigation: desiredState });
});
