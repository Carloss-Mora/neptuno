/// <reference path="../pb_data/types.d.ts" />

// Zonas de riego: cada zona tiene su válvula (canal 1-8) y, opcionalmente, su caudal y sus sensores de suelo.
// Los registros de riego de una zona llevan zoneId; los del cultivo completo siguen sin zoneId.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const crops = app.findCollectionByNameOrId('crops');

  const zones = new Collection({ name: 'zones', type: 'base' });
  app.save(zones);
  zones.fields.add(
    new RelationField({ name: 'userId', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new RelationField({ name: 'cropId', collectionId: crops.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new TextField({ name: 'name', required: true, min: 1, max: 60 }),
    new NumberField({ name: 'valve_channel', required: true, min: 1, max: 8 }),
    new NumberField({ name: 'flow_lpm', min: 0 }),
    new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
    new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
  );
  app.save(zones);
  zones.indexes = ['CREATE INDEX idx_zones_crop ON zones (cropId)'];
  const owner = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  zones.listRule = owner;
  zones.viewRule = owner;
  zones.createRule = [
    '@request.auth.id != ""',
    '@request.body.userId = @request.auth.id',
    '@request.body.cropId.userId = @request.auth.id',
  ].join(' && ');
  zones.updateRule = [owner, '@request.body.userId:isset = false', '@request.body.cropId:isset = false'].join(' && ');
  zones.deleteRule = owner;
  app.save(zones);

  const sensors = app.findCollectionByNameOrId('sensors');
  sensors.fields.add(new RelationField({ name: 'zoneId', collectionId: zones.id, maxSelect: 1, cascadeDelete: false }));
  app.save(sensors);

  const logs = app.findCollectionByNameOrId('irrigation_logs');
  logs.fields.add(new RelationField({ name: 'zoneId', collectionId: zones.id, maxSelect: 1, cascadeDelete: true }));
  logs.indexes = [...logs.indexes, 'CREATE INDEX idx_irrigation_logs_zone ON irrigation_logs (zoneId)'];
  return app.save(logs);
}, (app) => {
  const logs = app.findCollectionByNameOrId('irrigation_logs');
  logs.indexes = logs.indexes.filter((index) => !index.includes('idx_irrigation_logs_zone'));
  logs.fields.removeByName('zoneId');
  app.save(logs);
  const sensors = app.findCollectionByNameOrId('sensors');
  sensors.fields.removeByName('zoneId');
  app.save(sensors);
  return app.delete(app.findCollectionByNameOrId('zones'));
});
