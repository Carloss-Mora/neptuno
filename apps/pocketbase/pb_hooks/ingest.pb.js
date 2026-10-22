/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/neptuno/ingest', (e) => {
  const request = e.requestInfo();
  const body = request.body || {};
  const deviceKey = String(request.headers['X-Device-Key'] || request.headers['x-device-key'] || '');
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
  if (lastIngest && !Number.isNaN(lastIngest.getTime()) && now.getTime() - lastIngest.getTime() < intervalSeconds * 1000) {
    throw new TooManyRequestsError(`Espera ${intervalSeconds} segundos entre lecturas.`);
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

  const crop = $app.findRecordById('crops', device.get('cropId'));
  let desiredState = String(device.get('desired_state') || 'OFF');
  const logs = $app.findRecordsByFilter(
    'irrigation_logs',
    'cropId = {:cropId}',
    '-created',
    100,
    0,
    { cropId: device.get('cropId') },
  );
  const latestLog = logs[0] || null;
  if (latestLog && (latestLog.get('status') === 'ON' || latestLog.get('status') === 'OFF')) {
    desiredState = latestLog.get('status');
  }

  const previousLastSeen = device.get('last_seen') ? new Date(device.get('last_seen')).getTime() : 0;
  const latestLogTimestamp = latestLog ? new Date(latestLog.get('created')).getTime() : 0;
  const recentManualOverride = latestLog?.get('source') === 'MANUAL'
    && latestLogTimestamp > previousLastSeen;

  if (crop.get('control_mode') === 'AUTO' && !recentManualOverride) {
    const policy = globalThis.NeptunoIrrigationPolicy;
    if (!policy || typeof policy.decide !== 'function') {
      throw new Error('Automatic irrigation policy is not loaded.');
    }

    const latestStoppedLog = logs.find((log) => log.get('status') === 'OFF');
    const decision = policy.decide({
      humidity: soilHumidity,
      humidityMin: crop.get('humidity_min') == null ? NaN : Number(crop.get('humidity_min')),
      humidityMax: crop.get('humidity_max') == null ? NaN : Number(crop.get('humidity_max')),
      waterLevel: waterLevel,
      currentState: desiredState,
      nowMs: now.getTime(),
      activeSinceMs: desiredState === 'ON' && latestLog ? new Date(latestLog.get('created')).getTime() : NaN,
      lastStoppedAtMs: latestStoppedLog ? new Date(latestStoppedLog.get('created')).getTime() : NaN,
      maxContinuousMs: Number(crop.get('max_irrigation_minutes')) * 60000,
      minRestMs: Number(crop.get('min_rest_minutes')) * 60000,
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
  const alertCode = waterLevel < 20
    ? 'water_low'
    : humidityMinimum != null && soilHumidity < Number(humidityMinimum)
      ? 'humidity_low'
      : '';
  const previousAlertCode = String(device.get('last_alert_code') || '');
  if (alertCode !== previousAlertCode) {
    device.set('last_alert_code', alertCode);
    if (alertCode) {
      try {
        const user = $app.findRecordById('users', device.get('userId'));
        const message = alertCode === 'water_low'
          ? 'El nivel de agua del dispositivo está por debajo del 20%.'
          : `La humedad del cultivo está por debajo del mínimo configurado (${humidityMinimum}%).`;
        $app.newMailClient().send(new MailerMessage({
          from: {
            address: $app.settings().meta.senderAddress,
            name: $app.settings().meta.senderName || 'Neptuno',
          },
          to: [{ address: user.get('email') }],
          subject: 'Alerta del cultivo en Neptuno',
          text: message,
          html: `<p>${message}</p>`,
        }));
        device.set('last_alert_sent_at', now.toISOString());
      } catch (mailError) {
        console.error(`Could not send an alert email for device ${device.id}:`, mailError);
      }
    }
  }
  $app.save(device);

  return e.json(200, { irrigation: desiredState });
});
