/// <reference path="../pb_data/types.d.ts" />

// Laboratorio de simulación: rutas autenticadas y cron. Todo lo simulado queda marcado como
// demo y separado de los dispositivos físicos (ver simulation-engine.js).
// Nota: los handlers de PocketBase se ejecutan aislados, por eso no hay helpers a nivel de archivo.

routerAdd('POST', '/api/neptuno/simulations', (e) => {
  const engine = require(`${__hooks}/simulation-engine.js`);
  const body = e.requestInfo().body || {};
  const cropId = String(body.cropId || '');
  if (!cropId) throw new BadRequestError('El cultivo es obligatorio.');
  const crop = $app.findRecordById('crops', cropId);
  if (String(crop.get('userId')) !== String(e.auth.id)) {
    throw new ForbiddenError('El cultivo no pertenece al usuario autenticado.');
  }

  const existing = $app.findRecordsByFilter('simulations', 'cropId = {:cropId}', '', 1, 0, { cropId });
  if (existing.length > 0) return e.json(200, { simulation: existing[0].publicExport() });

  const defaults = engine.defaultsFor(crop);
  let simulation;
  $app.runInTransaction((txApp) => {
    const device = new Record(txApp.findCollectionByNameOrId('devices'), {
      userId: e.auth.id,
      cropId,
      name: `Simulador · ${String(crop.get('name')).slice(0, 80)}`,
      key_hash: $security.sha256($security.randomString(64)),
      interval_seconds: 300,
      desired_state: 'OFF',
      is_demo: true,
      is_simulated: true,
    });
    txApp.save(device);
    simulation = new Record(txApp.findCollectionByNameOrId('simulations'), {
      userId: e.auth.id,
      cropId,
      deviceId: device.id,
      status: 'paused',
      fault: 'none',
      humidity: defaults.humidity,
      temperature: defaults.temperature,
      water_level: defaults.water_level,
      step_minutes: defaults.step_minutes,
      sim_time_ms: Date.now(),
      ticks: 0,
    });
    txApp.save(simulation);
  });
  return e.json(201, { simulation: simulation.publicExport() });
}, $apis.requireAuth());

routerAdd('POST', '/api/neptuno/simulations/{id}/command', (e) => {
  const engine = require(`${__hooks}/simulation-engine.js`);
  const model = require(`${__hooks}/simulation-model.js`);
  const sim = $app.findRecordById('simulations', e.request.pathValue('id'));
  if (String(sim.get('userId')) !== String(e.auth.id)) {
    throw new ForbiddenError('La simulación no pertenece al usuario autenticado.');
  }
  const body = e.requestInfo().body || {};
  const command = String(body.command || '');
  const value = Number(body.value);
  const ranged = (min, max, label) => {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new BadRequestError(`${label} debe estar entre ${min} y ${max}.`);
    }
    return value;
  };

  switch (command) {
    case 'start':
      sim.set('status', 'running');
      $app.save(sim);
      break;
    case 'pause':
      sim.set('status', 'paused');
      $app.save(sim);
      break;
    case 'step':
      engine.step($app, sim, '');
      break;
    case 'set_humidity':
      sim.set('humidity', ranged(0, 100, 'La humedad'));
      $app.save(sim);
      break;
    case 'set_water':
      sim.set('water_level', ranged(0, 100, 'El nivel de agua'));
      $app.save(sim);
      break;
    case 'set_temperature':
      sim.set('temperature', ranged(-10, 60, 'La temperatura'));
      $app.save(sim);
      break;
    case 'set_step_minutes':
      sim.set('step_minutes', Math.round(ranged(1, 60, 'El paso')));
      $app.save(sim);
      break;
    case 'set_fault': {
      const fault = String(body.fault || '');
      if (!model.FAULTS.includes(fault)) throw new BadRequestError('Fallo no válido.');
      sim.set('fault', fault);
      if (fault === 'none') sim.set('offline_minutes', 0);
      $app.save(sim);
      break;
    }
    case 'reset': {
      const crop = $app.findRecordById('crops', sim.get('cropId'));
      const defaults = engine.defaultsFor(crop);
      const device = $app.findRecordById('devices', sim.get('deviceId'));
      engine.clearHistory($app, sim);
      device.set('desired_state', 'OFF');
      device.set('last_alert_code', '');
      device.set('last_seen', '');
      device.set('last_ingest_at', '');
      $app.save(device);
      sim.set('status', 'paused');
      sim.set('fault', 'none');
      sim.set('humidity', defaults.humidity);
      sim.set('temperature', defaults.temperature);
      sim.set('water_level', defaults.water_level);
      sim.set('step_minutes', defaults.step_minutes);
      sim.set('sim_time_ms', Date.now());
      sim.set('on_since_ms', 0);
      sim.set('off_since_ms', 0);
      sim.set('offline_minutes', 0);
      sim.set('ticks', 0);
      sim.set('last_state', '');
      sim.set('last_reason', '');
      $app.save(sim);
      break;
    }
    case 'delete': {
      const device = $app.findRecordById('devices', sim.get('deviceId'));
      engine.clearHistory($app, sim);
      $app.delete(sim);
      $app.delete(device);
      return e.json(200, { deleted: true });
    }
    default:
      throw new BadRequestError('Comando no válido.');
  }
  return e.json(200, { simulation: $app.findRecordById('simulations', sim.id).publicExport() });
}, $apis.requireAuth());

// Cada minuto real avanza un paso de las simulaciones en marcha.
cronAdd('simulation-tick', '* * * * *', () => {
  const engine = require(`${__hooks}/simulation-engine.js`);
  const running = $app.findRecordsByFilter('simulations', "status = 'running'", '', 200, 0);
  for (const sim of running) {
    try {
      engine.step($app, sim, '');
    } catch (error) {
      console.error(`Falló el paso de la simulación ${sim.id}:`, error);
    }
  }
});
