/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.add(new NumberField({ name: 'flow_lpm', min: 0.01, max: 100000 }));
  app.save(crops);

  const devices = new Collection({
    name: 'devices',
    type: 'base',
  });
  app.save(devices);
  devices.fields.add(
    new RelationField({ name: 'userId', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new RelationField({ name: 'cropId', collectionId: crops.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new TextField({ name: 'name', required: true, min: 1, max: 100 }),
    new TextField({ name: 'key_hash', required: true, max: 64, hidden: true }),
    new DateField({ name: 'last_seen' }),
    new DateField({ name: 'last_ingest_at' }),
    new DateField({ name: 'last_alert_sent_at' }),
    new TextField({ name: 'last_alert_code', max: 40 }),
    new NumberField({ name: 'interval_seconds', required: true, min: 1, max: 3600 }),
    new SelectField({ name: 'desired_state', required: true, maxSelect: 1, values: ['ON', 'OFF'] }),
  );
  app.save(devices);
  devices.listRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  devices.viewRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  devices.createRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  devices.updateRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  devices.deleteRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  app.save(devices);

  const readings = app.findCollectionByNameOrId('sensor_readings');
  readings.fields.add(new RelationField({
    name: 'deviceId',
    collectionId: devices.id,
    maxSelect: 1,
    cascadeDelete: true,
  }));
  return app.save(readings);
}, (app) => {
  const devices = app.findCollectionByNameOrId('devices');
  for (const record of app.findAllRecords(devices)) app.delete(record);
  app.delete(devices);

  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.removeByName('flow_lpm');
  app.save(crops);
  const readings = app.findCollectionByNameOrId('sensor_readings');
  readings.fields.removeByName('deviceId');
  return app.save(readings);
});
