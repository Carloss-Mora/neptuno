// Motor del Laboratorio de simulación. Cada paso avanza el reloj simulado, aplica la física del
// suelo y pasa la lectura por el MISMO motor de decisiones que usa un dispositivo físico
// (irrigation-core.js). Los registros se marcan is_demo y el dispositivo is_simulated: no existe
// ninguna ruta por la que una orden simulada llegue a una bomba real.
const DEFAULTS = { humidity: 50, temperature: 22, water_level: 80, step_minutes: 5 };
const EVENT_LIMIT = 500;

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const orNaN = (value) => (num(value) > 0 ? num(value) : NaN);

const addEvent = (app, sim, data) => {
  app.save(new Record(app.findCollectionByNameOrId('simulation_events'), {
    simulationId: sim.id,
    userId: sim.get('userId'),
    ...data,
  }));
};

const pruneEvents = (app, sim) => {
  const total = app.countRecords('simulation_events', $dbx.hashExp({ simulationId: sim.id }));
  if (total <= EVENT_LIMIT) return;
  const oldest = app.findRecordsByFilter('simulation_events', 'simulationId = {:id}', 'sim_time_ms', total - EVENT_LIMIT + 50, 0, { id: sim.id });
  for (const event of oldest) app.delete(event);
};

module.exports = {
  DEFAULTS,

  defaultsFor(crop) {
    const { isSet } = require(`${__hooks}/optional-number.js`);
    const min = Number(crop.get('humidity_min'));
    const max = Number(crop.get('humidity_max'));
    const humidity = isSet(min) && isSet(max) ? Math.round((min + max) / 2) : DEFAULTS.humidity;
    return { ...DEFAULTS, humidity };
  },

  step(app, sim, note) {
    const model = require(`${__hooks}/simulation-model.js`);
    const core = require(`${__hooks}/irrigation-core.js`);
    const crop = app.findRecordById('crops', sim.get('cropId'));
    const device = app.findRecordById('devices', sim.get('deviceId'));
    const stepMinutes = Math.max(1, num(sim.get('step_minutes')) || DEFAULTS.step_minutes);
    const nowMs = (num(sim.get('sim_time_ms')) || Date.now()) + stepMinutes * 60000;
    const fault = String(sim.get('fault') || 'none');
    const wasOn = String(device.get('desired_state') || 'OFF') === 'ON';

    const next = model.physics({
      humidity: num(sim.get('humidity')),
      waterLevel: num(sim.get('water_level')),
      irrigating: wasOn,
      fault,
      stepMinutes,
    });
    const temperature = num(sim.get('temperature'));
    let onSinceMs = orNaN(sim.get('on_since_ms'));
    let offSinceMs = orNaN(sim.get('off_since_ms'));
    let offlineMinutes = num(sim.get('offline_minutes'));
    let state = wasOn ? 'ON' : 'OFF';
    let reason = '';
    let eventNote = note || '';

    if (fault === 'sensor_offline' || fault === 'invalid_reading') {
      // Sin lectura válida: el motor no recibe datos y aplica la parada segura tras un tiempo.
      offlineMinutes += stepMinutes;
      reason = fault;
      eventNote = fault === 'sensor_offline' ? 'Sin lectura del sensor.' : 'Lectura inválida rechazada (humedad 150 %).';
      if (wasOn && offlineMinutes >= model.OFFLINE_SAFE_STOP_MINUTES) {
        app.save(new Record(app.findCollectionByNameOrId('irrigation_logs'), {
          userId: sim.get('userId'),
          cropId: sim.get('cropId'),
          status: 'OFF',
          source: 'WATCHDOG',
          deviceId: device.id,
          is_demo: true,
        }));
        device.set('desired_state', 'OFF');
        app.save(device);
        state = 'OFF';
        reason = 'safe_stop_no_reading';
        eventNote = `Parada segura: ${offlineMinutes} min simulados sin lectura válida.`;
      }
    } else {
      offlineMinutes = 0;
      const result = core.processReading(
        app,
        device,
        crop,
        { soilHumidity: next.humidity, temperature, waterLevel: next.waterLevel },
        {
          isDemo: true,
          nowMs,
          clock: { activeSinceMs: onSinceMs, lastStoppedAtMs: offSinceMs, pulseCycle: Boolean(sim.get('pulse_cycle')), cycleOnMs: num(sim.get('cycle_on_ms')) },
          skipNotifications: true,
        },
      );
      state = result.desiredState;
      reason = result.reason;
      // Seguimiento del ciclo de pulsos para el siguiente paso.
      if (result.pulse === 'pause') {
        sim.set('cycle_on_ms', num(sim.get('cycle_on_ms')) + Math.max(0, nowMs - onSinceMs));
        sim.set('pulse_cycle', true);
      } else if (result.pulse === 'resume') {
        sim.set('pulse_cycle', false);
      } else if (state === 'OFF' && (wasOn || result.endCycle)) {
        sim.set('pulse_cycle', false);
        sim.set('cycle_on_ms', 0);
      } else if (state === 'ON' && !wasOn) {
        sim.set('cycle_on_ms', 0);
      }
    }

    if (state === 'ON' && !wasOn) { onSinceMs = nowMs; }
    if (state === 'OFF' && wasOn) { offSinceMs = nowMs; onSinceMs = NaN; }

    sim.set('humidity', next.humidity);
    sim.set('water_level', next.waterLevel);
    sim.set('sim_time_ms', nowMs);
    sim.set('on_since_ms', Number.isFinite(onSinceMs) ? onSinceMs : 0);
    sim.set('off_since_ms', Number.isFinite(offSinceMs) ? offSinceMs : 0);
    sim.set('offline_minutes', offlineMinutes);
    sim.set('ticks', num(sim.get('ticks')) + 1);
    sim.set('last_state', state);
    sim.set('last_reason', reason);
    app.save(sim);

    addEvent(app, sim, {
      sim_time_ms: nowMs,
      humidity: next.humidity,
      temperature,
      water_level: next.waterLevel,
      state,
      reason,
      fault,
      note: eventNote,
    });
    if (num(sim.get('ticks')) % 50 === 0) pruneEvents(app, sim);
    return { state, reason };
  },

  // Borra las lecturas y registros simulados del dispositivo virtual (nunca los de dispositivos físicos).
  clearHistory(app, sim) {
    const filter = 'deviceId = {:deviceId} && is_demo = true';
    const params = { deviceId: sim.get('deviceId') };
    for (const name of ['sensor_readings', 'irrigation_logs']) {
      const rows = app.findRecordsByFilter(name, filter, '', 5000, 0, params);
      for (const row of rows) app.delete(row);
    }
    const events = app.findRecordsByFilter('simulation_events', 'simulationId = {:id}', '', 5000, 0, { id: sim.id });
    for (const event of events) app.delete(event);
  },
};
