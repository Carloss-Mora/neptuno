/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.updateRule = 'userId = @request.auth.id && @request.body.userId:isset = false';
  app.save(crops);

  const schedules = app.findCollectionByNameOrId('irrigation_schedules');
  schedules.updateRule = [
    'userId = @request.auth.id',
    'cropId.userId = @request.auth.id',
    '@request.body.userId:isset = false',
    '@request.body.cropId:isset = false',
  ].join(' && ');
  app.save(schedules);

  const devices = app.findCollectionByNameOrId('devices');
  devices.updateRule = [
    'userId = @request.auth.id',
    'cropId.userId = @request.auth.id',
    '@request.body.userId:isset = false',
    '@request.body.cropId:isset = false',
    '@request.body.key_hash:isset = false',
    '@request.body.desired_state:isset = false',
    '@request.body.last_seen:isset = false',
    '@request.body.last_ingest_at:isset = false',
    '@request.body.last_alert_code:isset = false',
    '@request.body.last_alert_sent_at:isset = false',
    '@request.body.is_demo:isset = false',
  ].join(' && ');
  app.save(devices);

  for (const collectionName of ['sensor_readings', 'water_consumption', 'irrigation_logs']) {
    const collection = app.findCollectionByNameOrId(collectionName);
    collection.updateRule = null;
    collection.deleteRule = null;
    app.save(collection);
  }

  const logs = app.findCollectionByNameOrId('irrigation_logs');
  for (const record of app.findRecordsByFilter(logs, 'source = "AUTOMATIC"', '', 0, 0)) {
    record.set('source', 'SCHEDULE');
    app.save(record);
  }
}, (app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.updateRule = 'userId = @request.auth.id';
  app.save(crops);

  const schedules = app.findCollectionByNameOrId('irrigation_schedules');
  schedules.updateRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  app.save(schedules);

  const devices = app.findCollectionByNameOrId('devices');
  devices.updateRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  app.save(devices);

  for (const collectionName of ['sensor_readings', 'water_consumption', 'irrigation_logs']) {
    const collection = app.findCollectionByNameOrId(collectionName);
    collection.updateRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
    collection.deleteRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
    app.save(collection);
  }
});
