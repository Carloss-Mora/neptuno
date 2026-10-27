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
    const flowLpm = options && Number.isFinite(options.flowLpm) ? options.flowLpm : NaN;
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

    // Estado de cada sensor individual (solo con datos reales: el Laboratorio no toca los sensores).
    if (!isDemo) {
      try {
        require(`${__hooks}/sensor-status.js`).update(app, device.get('cropId'), reading, (options && options.sensorReadings) || null, nowIso);
      } catch (sensorError) {
        console.error(`No se pudo actualizar el estado de los sensores del cultivo ${device.get('cropId')}:`, sensorError);
      }
    }

    let desiredState = String(device.get('desired_state') || 'OFF');
    const latestLogs = app.findRecordsByFilter('irrigation_logs', 'cropId = {:cropId}', '-created', 1, 0, { cropId: device.get('cropId') });
    const latestLog = latestLogs[0] || null;
    if (latestLog && (latestLog.get('status') === 'ON' || latestLog.get('status') === 'OFF')) {
      desiredState = latestLog.get('status');
    }

    let reason = 'manual_mode';
    let pulseInfo = { pulse: '', endCycle: false };
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
      let pulseState = { inPulseCycle: false, cycleOnMs: 0 };
      if (clock) {
        pulseState = { inPulseCycle: Boolean(clock.pulseCycle), cycleOnMs: Number(clock.cycleOnMs) || 0 };
      } else {
        const recent = app.findRecordsByFilter('irrigation_logs', 'cropId = {:cropId}', '-created', 40, 0, { cropId: device.get('cropId') });
        pulseState = policy.cycleFromLogs(recent.map((log) => ({
          status: String(log.get('status')),
          source: String(log.get('source') || ''),
          createdMs: new Date(String(log.get('created')).replace(' ', 'T')).getTime(),
        })));
      }
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
        pulseOnMs: Number(crop.get('pulse_on_minutes')) * 60000,
        pulseOffMs: Number(crop.get('pulse_off_minutes')) * 60000,
        inPulseCycle: pulseState.inPulseCycle,
        cycleOnMs: pulseState.cycleOnMs,
      });
      reason = decision.reason;
      if (decision.state === 'ON' && desiredState !== 'ON' && decision.reason === 'humidity_low') {
        const rainGuard = require(`${__hooks}/rain-guard.js`);
        if (rainGuard.shouldSkip(crop, nowMs, soilHumidity, Number(crop.get('humidity_min')))) {
          decision.state = 'OFF';
          decision.reason = 'rain_expected';
          reason = 'rain_expected';
        }
      }
      pulseInfo = { pulse: decision.pulse || '', endCycle: Boolean(decision.endCycle) };
      if (decision.state !== desiredState || decision.endCycle) {
        app.save(new Record(app.findCollectionByNameOrId('irrigation_logs'), {
          userId: device.get('userId'),
          cropId: device.get('cropId'),
          status: decision.state,
          source: decision.pulse ? 'PULSE' : 'THRESHOLD',
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
    let flowAlert = '';
    if (!isDemo && Number.isFinite(flowLpm)) {
      device.set('last_flow_lpm', flowLpm);
      device.set('last_flow_at', nowIso);
      // Desde cuándo está la válvula en el estado actual (el último registro de riego, o ahora si acaba de cambiar).
      const sinceLog = app.findRecordsByFilter('irrigation_logs', 'cropId = {:cropId}', '-created', 1, 0, { cropId: device.get('cropId') })[0];
      const stateSinceMs = sinceLog ? new Date(String(sinceLog.get('created')).replace(' ', 'T')).getTime() : NaN;
      flowAlert = require(`${__hooks}/flow-check.js`).check({
        measured: flowLpm,
        expected: isSet(crop.get('flow_lpm')) ? Number(crop.get('flow_lpm')) : NaN,
        valveOn: desiredState === 'ON',
        stateSinceMs,
        nowMs,
      });
    }
    const alertCode = flowAlert
      ? flowAlert
      : isSet(waterMinimum) && waterLevel < Number(waterMinimum)
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
          const message = alertCode === 'flow_leak'
            ? `Sale agua (${flowLpm} L/min) con el riego apagado. Revisa si hay una fuga o la válvula quedó abierta.`
            : alertCode === 'flow_low'
              ? `El caudal medido (${flowLpm} L/min) es menos de la mitad del esperado (${crop.get('flow_lpm')} L/min). Revisa si hay una obstrucción en filtros o goteros.`
              : alertCode === 'water_low'
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
    return { desiredState, reason, pulse: pulseInfo.pulse, endCycle: pulseInfo.endCycle };
  },
};
