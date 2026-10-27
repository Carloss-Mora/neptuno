/// <reference path="../pb_data/types.d.ts" />

// Exportación de los datos del propio usuario (privacidad). Solo devuelve sus registros.
routerAdd('GET', '/api/neptuno/me/export', (e) => {
  const userId = e.auth.id;
  const grab = (collection, filter, sort, limit) => $app
    .findRecordsByFilter(collection, filter, sort, limit, 0, { userId })
    .map((record) => record.publicExport());
  const devices = grab('devices', 'userId = {:userId}', 'created', 200).map((device) => {
    delete device.key_hash;
    return device;
  });
  return e.json(200, {
    exported_at: new Date().toISOString(),
    user: { id: userId, email: e.auth.get('email'), name: e.auth.get('name') },
    crops: grab('crops', 'userId = {:userId}', 'created', 500),
    devices,
    sensors: grab('sensors', 'userId = {:userId}', 'created', 500),
    irrigation_schedules: grab('irrigation_schedules', 'userId = {:userId}', 'created', 1000),
    irrigation_logs: grab('irrigation_logs', 'userId = {:userId} && is_demo != true', '-created', 20000),
    sensor_readings: grab('sensor_readings', 'userId = {:userId} && is_demo != true', '-created', 20000),
    sensor_readings_hourly: grab('sensor_readings_hourly', 'userId = {:userId}', '-hour_start', 20000),
    settings: grab('user_settings', 'userId = {:userId}', '-updated', 1),
  });
}, $apis.requireAuth());

// Al eliminar una cuenta no deben quedar datos personales huérfanos: algunas colecciones antiguas guardan
// userId como texto (sin borrado en cascada), así que se limpian aquí.
onRecordAfterDeleteSuccess((e) => {
  const userId = e.record.id;
  for (const collection of $app.findAllCollections('base')) {
    const field = collection.fields.getByName('userId');
    if (!field || field.type() !== 'text') continue;
    for (const record of $app.findRecordsByFilter(collection, 'userId = {:userId}', '', 0, 0, { userId })) {
      $app.delete(record);
    }
  }
  e.next();
}, 'users');
