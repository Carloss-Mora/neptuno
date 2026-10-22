/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const logs = app.findCollectionByNameOrId('irrigation_logs');
  logs.indexes = [
    ...logs.indexes.filter((index) => !index.includes('idx_irrigation_logs_crop_created')),
    'CREATE INDEX idx_irrigation_logs_crop_created ON irrigation_logs (cropId, created)',
  ];
  app.save(logs);

  const readings = app.findCollectionByNameOrId('sensor_readings');
  readings.indexes = [
    ...readings.indexes.filter((index) => !index.includes('idx_sensor_readings_crop_created')),
    'CREATE INDEX idx_sensor_readings_crop_created ON sensor_readings (cropId, created)',
  ];
  app.save(readings);

  const schedules = app.findCollectionByNameOrId('irrigation_schedules');
  schedules.indexes = [
    ...schedules.indexes.filter((index) => !index.includes('idx_irrigation_schedules_crop')),
    'CREATE INDEX idx_irrigation_schedules_crop ON irrigation_schedules (cropId)',
  ];
  app.save(schedules);

  const devices = app.findCollectionByNameOrId('devices');
  devices.indexes = [
    ...devices.indexes.filter((index) => !index.includes('idx_devices_crop')),
    'CREATE INDEX idx_devices_crop ON devices (cropId)',
  ];
  app.save(devices);

  const users = app.findCollectionByNameOrId('users');
  const crops = app.findCollectionByNameOrId('crops');
  const hourly = new Collection({ name: 'sensor_readings_hourly', type: 'base' });
  app.save(hourly);
  hourly.fields.add(
    new RelationField({ name: 'userId', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new RelationField({ name: 'cropId', collectionId: crops.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new DateField({ name: 'hour_start', required: true }),
    new NumberField({ name: 'humidity_avg', required: true, min: 0, max: 100 }),
    new NumberField({ name: 'temperature_avg', required: true, min: -10, max: 60 }),
    new NumberField({ name: 'water_level_avg', required: true, min: 0, max: 100 }),
    new NumberField({ name: 'sample_count', required: true, min: 1 }),
    new BoolField({ name: 'is_demo' }),
  );
  app.save(hourly);
  hourly.indexes = [
    'CREATE UNIQUE INDEX idx_sensor_readings_hourly_crop_hour ON sensor_readings_hourly (cropId, hour_start)',
  ];
  hourly.listRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  hourly.viewRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  hourly.createRule = null;
  hourly.updateRule = null;
  hourly.deleteRule = null;
  return app.save(hourly);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('sensor_readings_hourly'));
  for (const [collectionName, indexName] of [
    ['irrigation_logs', 'idx_irrigation_logs_crop_created'],
    ['sensor_readings', 'idx_sensor_readings_crop_created'],
    ['irrigation_schedules', 'idx_irrigation_schedules_crop'],
    ['devices', 'idx_devices_crop'],
  ]) {
    const collection = app.findCollectionByNameOrId(collectionName);
    collection.indexes = collection.indexes.filter((index) => !index.includes(indexName));
    app.save(collection);
  }
});
