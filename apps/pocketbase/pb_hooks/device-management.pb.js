/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/neptuno/devices', (e) => {
  let stage = 'validate request';
  try {
    const body = e.requestInfo().body || {};
    const cropId = String(body.cropId || '');
    const name = String(body.name || '').trim();
    const intervalSeconds = Number(body.interval_seconds);
    if (!cropId || !name || name.length > 100 || !Number.isInteger(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 3600) {
      throw new BadRequestError('El cultivo, el nombre y un intervalo entre 1 y 3600 segundos son obligatorios.');
    }

    stage = 'load and verify crop ownership';
    const crop = $app.findRecordById('crops', cropId);
    if (String(crop.get('userId')) !== String(e.auth.id)) {
      throw new ForbiddenError('El cultivo no pertenece al usuario autenticado.');
    }

    stage = 'create device record';
    const key = $security.randomString(64);
    const device = new Record($app.findCollectionByNameOrId('devices'), {
      userId: e.auth.id,
      cropId,
      name,
      key_hash: $security.sha256(key),
      interval_seconds: intervalSeconds,
      desired_state: 'OFF',
    });
    $app.save(device);
    stage = 'serialize response';
    return e.json(201, { device: device.publicExport(), key });
  } catch (error) {
    console.error(`Device registration failed during ${stage}:`, error);
    throw error;
  }
}, $apis.requireAuth());

routerAdd('POST', '/api/neptuno/devices/{id}/rotate-key', (e) => {
  const device = $app.findRecordById('devices', e.request.pathValue('id'));
  if (String(device.get('userId')) !== String(e.auth.id)) {
    throw new ForbiddenError('El dispositivo no pertenece al usuario autenticado.');
  }

  const key = $security.randomString(64);
  device.set('key_hash', $security.sha256(key));
  $app.save(device);
  return e.json(200, { device: device.publicExport(), key });
}, $apis.requireAuth());

routerAdd('POST', '/api/neptuno/irrigation/manual', (e) => {
  const body = e.requestInfo().body || {};
  const cropId = String(body.cropId || '');
  const status = String(body.status || '');
  if (!cropId || (status !== 'ON' && status !== 'OFF')) {
    throw new BadRequestError('El cultivo y un estado ON u OFF son obligatorios.');
  }

  let createdLog = null;
  let manualOverrideUntil = '';
  $app.runInTransaction((txApp) => {
    const crop = txApp.findRecordById('crops', cropId);
    if (String(crop.get('userId')) !== String(e.auth.id)) {
      throw new ForbiddenError('El cultivo no pertenece al usuario autenticado.');
    }

    if (crop.get('control_mode') === 'AUTO') {
      const minutes = Math.max(1, Number(crop.get('manual_override_minutes')) || 30);
      manualOverrideUntil = new Date(Date.now() + minutes * 60000).toISOString();
      crop.set('manual_override_until', manualOverrideUntil);
      txApp.save(crop);
    }

    createdLog = new Record(txApp.findCollectionByNameOrId('irrigation_logs'), {
      userId: e.auth.id,
      cropId,
      status,
      source: 'MANUAL',
    });
    txApp.save(createdLog);
    // Con zonas, el riego manual del cultivo abre o cierra todas las válvulas.
    require(`${__hooks}/zone-control.js`).mirror(txApp, crop, status, 'MANUAL');
  });

  return e.json(201, {
    log: createdLog.publicExport(),
    manual_override_until: manualOverrideUntil,
  });
}, $apis.requireAuth());
