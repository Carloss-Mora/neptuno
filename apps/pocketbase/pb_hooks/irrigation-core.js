// Lógica de una lectura de sensor, compartida por el endpoint /api/neptuno/ingest (dispositivo
// físico) y por el Laboratorio de simulación. Así el simulador prueba el mismo motor de decisiones.
// Uso: const core = require(`${__hooks}/irrigation-core.js`); core.processReading($app, device, crop, reading, options)
//   reading: { soilHumidity, temperature, waterLevel }
//   options: { isDemo, nowMs, clock: { activeSinceMs, lastStoppedAtMs }, skipNotifications }
module.exports = {
  processReading(app, device, crop, reading, options) {
    const { isSet } = require(`${__hooks}/optional-number.js`);
    const { soilHumidity, temperature, waterLevel } = reading;
    const isDemo = Boolean(options && options.isDemo);
    const nowMs = options && Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
    const clock = (options && options.clock) || null;
    const skipNotifications = Boolean(options && options.skipNotifications);
    const nowIso = new Date(nowMs).toISOString();

    app.save(new Record(app.findCollectionByNameOrId('sensor_readings'), {
      userId: device.get('userId'),
      cropId: device.get('cropId'),
      deviceId: device.id,
      soil_humidity: soilHumidity,
      temperature,
      water_level: waterLevel,
      is_demo: isDemo,
    }));

    let desiredState = String(device.get('desired_state') || 'OFF');
    const latestLogs = app.findRecordsByFilter('irrigation_logs', 'cropId = {:cropId}', '-created', 1, 0, { cropId: device.get('cropId') });
    const latestLog = latestLogs[0] || null;
    if (latestLog && (latestLog.get('status') === 'ON' || latestLog.get('status') === 'OFF')) {
      desiredState = latestLog.get('status');
    }

    let reason = 'manual_mode';
    if (crop.get('control_mode') === 'AUTO') {
      const policy = require(`${__hooks}/irrigation-policy.js`);
      let activeSinceMs = desiredState === 'ON' && latestLog ? new Date(latestLog.get('created')).getTime() : NaN;
      let lastStoppedAtMs = NaN;
      if (clock) {
        activeSinceMs = clock.activeSinceMs;
        lastStoppedAtMs = clock.lastStoppedAtMs;
      } else {
        const stoppedLogs = app.findRecordsByFilter('irrigation_logs', 'cropId = {:cropId} && status = "OFF"', '-created', 1, 0, { cropId: device.get('cropId') });
        lastStoppedAtMs = stoppedLogs[0] ? new Date(stoppedLogs[0].get('created')).getTime() : NaN;
      }
      const overrideUntil = crop.get('manual_override_until') ? new Date(crop.get('manual_override_until')).getTime() : 0;
      const decision = policy.decide({
        humidity: soilHumidity,
        humidityMin: isSet(crop.get('humidity_min')) ? Number(crop.get('humidity_min')) : NaN,
        humidityMax: isSet(crop.get('humidity_max')) ? Number(crop.get('humidity_max')) : NaN,
        waterLevel,
        currentState: desiredState,
        nowMs,
        activeSinceMs,
        lastStoppedAtMs,
        maxContinuousMs: Number(crop.get('max_irrigation_minutes')) * 60000,
        minRestMs: Number(crop.get('min_rest_minutes')) * 60000,
        manualOverrideUntilMs: overrideUntil,
      });
      reason = decision.reason;
      if (decision.state !== desiredState) {
        app.save(new Record(app.findCollectionByNameOrId('irrigation_logs'), {
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

    device.set('last_seen', nowIso);
    device.set('last_ingest_at', nowIso);
    device.set('desired_state', desiredState);
    device.set('is_demo', isDemo);
    const humidityMinimum = crop.get('humidity_min');
    const waterMinimum = crop.get('alert_water_min');
    const maximumTemperature = crop.get('alert_temp_max');
    // PocketBase devuelve 0 en los campos vacíos: solo cuentan los umbrales configurados (> 0).
    const alertCode = isSet(waterMinimum) && waterLevel < Number(waterMinimum)
      ? 'water_low'
      : isSet(humidityMinimum) && soilHumidity < Number(humidityMinimum)
        ? 'humidity_low'
        : isSet(maximumTemperature) && temperature > Number(maximumTemperature)
          ? 'temperature_high'
          : '';
    const previousAlertCode = String(device.get('last_alert_code') || '');
    if (alertCode !== previousAlertCode) {
      device.set('last_alert_code', alertCode);
      if (alertCode && !skipNotifications) {
        try {
          const message = alertCode === 'water_low'
            ? `El nivel de agua está por debajo del mínimo configurado (${waterMinimum}%).`
            : alertCode === 'humidity_low'
              ? `La humedad del cultivo está por debajo del mínimo configurado (${humidityMinimum}%).`
              : `La temperatura del cultivo superó el máximo configurado (${maximumTemperature} °C).`;
          const queueNotification = require(`${__hooks}/notification-queue.js`);
          queueNotification(app, device.get('userId'), crop.id, 'alert', 'Alerta del cultivo en Neptuno', message);
          device.set('last_alert_sent_at', nowIso);
        } catch (queueError) {
          console.error(`Could not queue an alert for device ${device.id}:`, queueError);
        }
      }
    }
    app.save(device);
    return { desiredState, reason };
  },
};
