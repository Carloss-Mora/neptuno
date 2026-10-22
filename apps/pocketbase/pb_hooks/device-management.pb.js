/// <reference path="../pb_data/types.d.ts" />

const createDeviceKey = () => $security.randomString(64);

routerAdd('POST', '/api/neptuno/devices', (e) => {
  const body = e.requestInfo().body || {};
  const cropId = String(body.cropId || '');
  const name = String(body.name || '').trim();
  const intervalSeconds = Number(body.interval_seconds);
  if (!cropId || !name || name.length > 100 || !Number.isInteger(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 3600) {
    throw new BadRequestError('El cultivo, el nombre y un intervalo entre 1 y 3600 segundos son obligatorios.');
  }

  const crop = $app.findRecordById('crops', cropId);
  if (String(crop.get('userId')) !== String(e.auth.id)) {
    throw new ForbiddenError('El cultivo no pertenece al usuario autenticado.');
  }

  const key = createDeviceKey();
  const device = new Record($app.findCollectionByNameOrId('devices'), {
    userId: e.auth.id,
    cropId,
    name,
    key_hash: $security.sha256(key),
    interval_seconds: intervalSeconds,
    desired_state: 'OFF',
  });
  $app.save(device);
  return e.json(201, { device: device.publicExport(), key });
}, $apis.requireAuth());

routerAdd('POST', '/api/neptuno/devices/{id}/rotate-key', (e) => {
  const device = $app.findRecordById('devices', e.request.pathValue('id'));
  if (String(device.get('userId')) !== String(e.auth.id)) {
    throw new ForbiddenError('El dispositivo no pertenece al usuario autenticado.');
  }

  const key = createDeviceKey();
  device.set('key_hash', $security.sha256(key));
  $app.save(device);
  return e.json(200, { device: device.publicExport(), key });
}, $apis.requireAuth());
