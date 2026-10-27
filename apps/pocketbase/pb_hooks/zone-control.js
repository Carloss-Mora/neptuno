// Control de riego por zonas (una válvula por zona). Los handlers de PocketBase son aislados:
//   const zoneControl = require(`${__hooks}/zone-control.js`);
const MAX_ZONES = 8;
const SENSOR_FRESH_MS = 10 * 60 * 1000;

const ms = (value) => new Date(String(value).replace(' ', 'T')).getTime();

module.exports = {
  MAX_ZONES,

  list(app, cropId) {
    return app.findRecordsByFilter('zones', 'cropId = {:cropId}', 'valve_channel', 0, 0, { cropId });
  },

  latestLog(app, zoneId) {
    return app.findRecordsByFilter('irrigation_logs', 'zoneId = {:zoneId}', '-created', 1, 0, { zoneId })[0] || null;
  },

  // Estado actual de cada zona según su último registro: [{ id, name, channel, state }]
  states(app, cropId) {
    return this.list(app, cropId).map((zone) => {
      const log = this.latestLog(app, zone.id);
      return {
        id: zone.id,
        name: String(zone.get('name')),
        channel: Number(zone.get('valve_channel')),
        state: log && log.get('status') === 'ON' ? 'ON' : 'OFF',
      };
    });
  },

  // Escribe un registro en cada zona cuyo estado cambia (riego manual, horario o parada de seguridad del cultivo completo).
  mirror(app, crop, status, source, deviceId, isDemo) {
    const collection = app.findCollectionByNameOrId('irrigation_logs');
    let changed = 0;
    for (const zone of this.list(app, crop.id)) {
      const log = this.latestLog(app, zone.id);
      const current = log && log.get('status') === 'ON' ? 'ON' : 'OFF';
      if (current === status) continue;
      const data = { userId: crop.get('userId'), cropId: crop.id, zoneId: zone.id, status, source };
      if (deviceId) data.deviceId = deviceId;
      if (isDemo) data.is_demo = true;
      app.save(new Record(collection, data));
      changed++;
    }
    return changed;
  },

  // Decide cada zona con la humedad de sus propios sensores (o la lectura general si no tiene) y la política del cultivo.
  decideAll(app, { device, crop, zones, soilHumidity, waterLevel, nowMs }) {
    const policy = require(`${__hooks}/irrigation-policy.js`);
    const rainGuard = require(`${__hooks}/rain-guard.js`);
    const { isSet } = require(`${__hooks}/optional-number.js`);
    const collection = app.findCollectionByNameOrId('irrigation_logs');
    const sensors = app.findRecordsByFilter('sensors', 'cropId = {:cropId} && kind = "soil_humidity"', '', 50, 0, { cropId: crop.id });
    const overrideUntil = crop.get('manual_override_until') ? ms(crop.get('manual_override_until')) : 0;
    const humidityMin = isSet(crop.get('humidity_min')) ? Number(crop.get('humidity_min')) : NaN;
    const humidityMax = isSet(crop.get('humidity_max')) ? Number(crop.get('humidity_max')) : NaN;
    const results = [];

    for (const zone of zones) {
      const own = sensors.filter((sensor) => String(sensor.get('zoneId')) === zone.id
        && sensor.get('last_reading_at')
        && nowMs - ms(sensor.get('last_reading_at')) <= SENSOR_FRESH_MS
        && Number.isFinite(Number(sensor.get('last_value'))));
      const humidity = own.length > 0
        ? own.reduce((total, sensor) => total + Number(sensor.get('last_value')), 0) / own.length
        : soilHumidity;

      const logs = app.findRecordsByFilter('irrigation_logs', 'zoneId = {:zoneId}', '-created', 40, 0, { zoneId: zone.id });
      const latest = logs[0] || null;
      const current = latest && latest.get('status') === 'ON' ? 'ON' : 'OFF';
      const activeSinceMs = current === 'ON' ? ms(latest.get('created')) : NaN;
      const stopped = logs.find((log) => log.get('status') === 'OFF');
      const lastStoppedAtMs = stopped ? ms(stopped.get('created')) : NaN;
      const cycle = policy.cycleFromLogs(logs.map((log) => ({
        status: String(log.get('status')),
        source: String(log.get('source') || ''),
        createdMs: ms(log.get('created')),
      })));

      const decision = policy.decide({
        humidity,
        humidityMin,
        humidityMax,
        waterLevel,
        currentState: current,
        nowMs,
        activeSinceMs,
        lastStoppedAtMs,
        maxContinuousMs: Number(crop.get('max_irrigation_minutes')) * 60000,
        minRestMs: Number(crop.get('min_rest_minutes')) * 60000,
        manualOverrideUntilMs: overrideUntil,
        pulseOnMs: Number(crop.get('pulse_on_minutes')) * 60000,
        pulseOffMs: Number(crop.get('pulse_off_minutes')) * 60000,
        inPulseCycle: cycle.inPulseCycle,
        cycleOnMs: cycle.cycleOnMs,
      });
      if (decision.state === 'ON' && current !== 'ON' && decision.reason === 'humidity_low'
        && rainGuard.shouldSkip(crop, nowMs, humidity, humidityMin)) {
        decision.state = 'OFF';
        decision.reason = 'rain_expected';
      }

      if (decision.state !== current || decision.endCycle) {
        app.save(new Record(collection, {
          userId: crop.get('userId'),
          cropId: crop.id,
          zoneId: zone.id,
          status: decision.state,
          source: decision.pulse ? 'PULSE' : 'THRESHOLD',
          deviceId: device.id,
        }));
      }
      results.push({ id: zone.id, name: String(zone.get('name')), channel: Number(zone.get('valve_channel')), state: decision.state, reason: decision.reason, humidity });
    }
    return results;
  },
};
