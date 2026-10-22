/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const devices = app.findCollectionByNameOrId('devices');
  devices.fields.add(new BoolField({ name: 'is_demo' }));
  app.save(devices);

  const readings = app.findCollectionByNameOrId('sensor_readings');
  readings.fields.add(new BoolField({ name: 'is_demo' }));
  app.save(readings);

  const logs = app.findCollectionByNameOrId('irrigation_logs');
  logs.fields.add(
    new RelationField({
      name: 'deviceId',
      collectionId: devices.id,
      maxSelect: 1,
      cascadeDelete: true,
    }),
    new BoolField({ name: 'is_demo' }),
  );
  return app.save(logs);
}, (app) => {
  const logs = app.findCollectionByNameOrId('irrigation_logs');
  logs.fields.removeByName('deviceId');
  logs.fields.removeByName('is_demo');
  app.save(logs);

  const readings = app.findCollectionByNameOrId('sensor_readings');
  readings.fields.removeByName('is_demo');
  app.save(readings);
  const devices = app.findCollectionByNameOrId('devices');
  devices.fields.removeByName('is_demo');
  return app.save(devices);
});
