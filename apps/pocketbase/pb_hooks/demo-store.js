// Guarda en la base de datos lo que genera demo-data.js. Todo queda marcado is_demo y sin dispositivo,
// así se distingue de los datos reales y de los del Laboratorio, y se puede borrar sin tocar nada real.
// Módulo CommonJS: recibe `app` ($app o txApp) para poder usarse dentro de transacciones.

const DAY_MS = 86400000;

module.exports = {
  clear(app, cropId) {
    for (const table of ['sensor_readings', 'irrigation_logs']) {
      app.db().newQuery(
        `DELETE FROM ${table} WHERE cropId = {:cropId} AND is_demo = 1 AND (deviceId IS NULL OR deviceId = '')`,
      ).bind({ cropId }).execute();
    }
  },

  ensureZonesAndSensors(app, crop) {
    const userId = crop.get('userId');
    const cropId = crop.id;
    let zones = app.findRecordsByFilter('zones', 'cropId = {:cropId}', 'valve_channel', 0, 0, { cropId });
    if (zones.length === 0) {
      ['Lote norte', 'Lote sur'].forEach((name, index) => {
        app.save(new Record(app.findCollectionByNameOrId('zones'), { userId, cropId, name, valve_channel: index + 1, flow_lpm: 0 }));
      });
      zones = app.findRecordsByFilter('zones', 'cropId = {:cropId}', 'valve_channel', 0, 0, { cropId });
    }
    const sensors = app.findRecordsByFilter('sensors', 'cropId = {:cropId}', '', 0, 0, { cropId });
    const sensorCol = app.findCollectionByNameOrId('sensors');
    // Cada zona necesita su sensor de suelo; temperatura y nivel del tanque solo si no hay ninguno.
    zones.forEach((zone, index) => {
      const has = sensors.some((sensor) => sensor.get('kind') === 'soil_humidity' && String(sensor.get('zoneId')) === zone.id);
      if (!has) app.save(new Record(sensorCol, { userId, cropId, name: `Humedad ${zone.get('name')}`, kind: 'soil_humidity', zoneId: zone.id, grid_row: 0, grid_col: index }));
    });
    if (!sensors.some((sensor) => sensor.get('kind') === 'temperature')) {
      app.save(new Record(sensorCol, { userId, cropId, name: 'Temperatura del cultivo', kind: 'temperature', grid_row: 1, grid_col: 0 }));
    }
    if (!sensors.some((sensor) => sensor.get('kind') === 'water_level')) {
      app.save(new Record(sensorCol, { userId, cropId, name: 'Nivel del tanque', kind: 'water_level', grid_row: 1, grid_col: 1 }));
    }
    return zones;
  },

  // Actualiza el último valor de cada sensor con la última lectura simulada.
  touchSensors(app, crop, zones, reading) {
    const zoneIndex = new Map(zones.map((zone, index) => [zone.id, index]));
    const nowIso = new Date(reading.t).toISOString();
    const sensors = app.findRecordsByFilter('sensors', 'cropId = {:cropId}', '', 0, 0, { cropId: crop.id });
    for (const sensor of sensors) {
      const kind = sensor.get('kind');
      let value = null;
      if (kind === 'soil_humidity') {
        const index = zoneIndex.get(String(sensor.get('zoneId')));
        value = index !== undefined && reading.zoneHumidity[index] !== undefined ? reading.zoneHumidity[index] : reading.humidity;
      } else if (kind === 'temperature') value = reading.temperature;
      else if (kind === 'water_level') value = reading.water;
      if (value === null) continue;
      sensor.set('last_value', Math.round(value * 10) / 10);
      sensor.set('last_reading_at', nowIso);
      app.save(sensor);
    }
  },

  // PocketBase pone siempre la fecha actual al crear: se corrige con SQL para que el historial quede en el pasado.
  backdate(app, table, id, iso) {
    app.db().newQuery(`UPDATE ${table} SET created = {:created}, updated = {:created} WHERE id = {:id}`)
      .bind({ created: iso.replace('T', ' '), id }).execute();
  },

  record(app, crop, userId, zones, event) {
    const iso = new Date(event.t).toISOString();
    if (event.type === 'reading') {
      const rec = new Record(app.findCollectionByNameOrId('sensor_readings'), {
        userId,
        cropId: crop.id,
        soil_humidity: Math.round(event.humidity * 10) / 10,
        temperature: Math.round(event.temperature * 10) / 10,
        water_level: Math.round(event.water * 10) / 10,
        is_demo: true,
      });
      app.save(rec);
      this.backdate(app, 'sensor_readings', rec.id, iso);
      return;
    }
    const fields = { userId, cropId: crop.id, status: event.status, source: 'THRESHOLD', is_demo: true };
    if (event.zone !== null && zones[event.zone]) fields.zoneId = zones[event.zone].id;
    const rec = new Record(app.findCollectionByNameOrId('irrigation_logs'), fields);
    app.save(rec);
    this.backdate(app, 'irrigation_logs', rec.id, iso);
  },

  seed(app, crop, days, live) {
    const demo = require(`${__hooks}/demo-data.js`);
    const now = Date.now();
    const span = Math.min(60, Math.max(1, Math.round(days || 30)));
    const params = demo.paramsFromCrop({
      humidity_min: crop.get('humidity_min'),
      humidity_max: crop.get('humidity_max'),
      max_irrigation_minutes: crop.get('max_irrigation_minutes'),
      min_rest_minutes: crop.get('min_rest_minutes'),
      flow_lpm: crop.get('flow_lpm'),
    });
    let counts = { readings: 0, logs: 0 };
    let zones = [];
    app.runInTransaction((tx) => {
      this.clear(tx, crop.id);
      zones = this.ensureZonesAndSensors(tx, crop);
      const state = demo.newState(now - span * DAY_MS, zones.length, 17);
      let last = null;
      demo.advance(state, params, now, (event) => {
        this.record(tx, crop, crop.get('userId'), zones, event);
        if (event.type === 'reading') { counts.readings += 1; last = event; } else counts.logs += 1;
      });
      if (last) this.touchSensors(tx, crop, zones, last);
      crop.set('demo_live', Boolean(live));
      crop.set('demo_state', state);
      tx.save(crop);
    });
    return counts;
  },

  // Sigue la simulación hasta ahora (cron cada 5 minutos).
  tick(app, crop) {
    const demo = require(`${__hooks}/demo-data.js`);
    const state = crop.get('demo_state');
    if (!state || !Array.isArray(state.zones)) return 0;
    const params = demo.paramsFromCrop({
      humidity_min: crop.get('humidity_min'),
      humidity_max: crop.get('humidity_max'),
      max_irrigation_minutes: crop.get('max_irrigation_minutes'),
      min_rest_minutes: crop.get('min_rest_minutes'),
      flow_lpm: crop.get('flow_lpm'),
    });
    const zones = app.findRecordsByFilter('zones', 'cropId = {:cropId}', 'valve_channel', 0, 0, { cropId: crop.id });
    // Si estuvo apagado mucho tiempo, no se rellena todo el hueco: se retoma desde hace 6 horas como máximo.
    state.t = Math.max(state.t, Date.now() - 6 * 3600000);
    let last = null;
    let written = 0;
    demo.advance(state, params, Date.now(), (event) => {
      this.record(app, crop, crop.get('userId'), zones, event);
      written += 1;
      if (event.type === 'reading') last = event;
    });
    if (last) this.touchSensors(app, crop, zones, { ...last, t: Date.now() });
    crop.set('demo_state', state);
    app.save(crop);
    return written;
  },
};
