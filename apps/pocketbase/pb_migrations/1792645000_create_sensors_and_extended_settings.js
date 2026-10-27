/// <reference path="../pb_data/types.d.ts" />

// Sensores individuales con posición en el plano del cultivo + ajustes ampliados por usuario.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const crops = app.findCollectionByNameOrId('crops');

  crops.fields.add(
    new NumberField({ name: 'layout_rows', min: 1, max: 6 }),
    new NumberField({ name: 'layout_cols', min: 1, max: 6 }),
  );
  app.save(crops);

  const sensors = new Collection({ name: 'sensors', type: 'base' });
  app.save(sensors);
  sensors.fields.add(
    new RelationField({ name: 'userId', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new RelationField({ name: 'cropId', collectionId: crops.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new TextField({ name: 'name', required: true, min: 1, max: 60 }),
    new SelectField({ name: 'kind', required: true, maxSelect: 1, values: ['soil_humidity', 'temperature', 'water_level'] }),
    new NumberField({ name: 'grid_row', min: 0, max: 5 }),
    new NumberField({ name: 'grid_col', min: 0, max: 5 }),
    new NumberField({ name: 'last_value' }),
    new DateField({ name: 'last_reading_at' }),
    new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
    new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
  );
  app.save(sensors);
  sensors.indexes = ['CREATE INDEX idx_sensors_crop ON sensors (cropId)'];
  const owner = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  sensors.listRule = owner;
  sensors.viewRule = owner;
  sensors.createRule = [
    '@request.auth.id != ""',
    '@request.body.userId = @request.auth.id',
    '@request.body.cropId.userId = @request.auth.id',
    '@request.body.last_value:isset = false',
    '@request.body.last_reading_at:isset = false',
  ].join(' && ');
  sensors.updateRule = [
    owner,
    '@request.body.userId:isset = false',
    '@request.body.cropId:isset = false',
    '@request.body.kind:isset = false',
    '@request.body.last_value:isset = false',
    '@request.body.last_reading_at:isset = false',
  ].join(' && ');
  sensors.deleteRule = owner;
  app.save(sensors);

  const settings = app.findCollectionByNameOrId('user_settings');
  settings.fields.add(
    new TextField({ name: 'timezone', max: 64 }),
    new SelectField({ name: 'unit_volume', maxSelect: 1, values: ['L', 'gal'] }),
    new SelectField({ name: 'unit_temp', maxSelect: 1, values: ['C', 'F'] }),
    new NumberField({ name: 'default_humidity_min', min: 0, max: 100 }),
    new NumberField({ name: 'default_humidity_max', min: 0, max: 100 }),
    new NumberField({ name: 'default_max_irrigation_minutes', min: 0, max: 1440 }),
    new NumberField({ name: 'default_min_rest_minutes', min: 0, max: 10080 }),
    new NumberField({ name: 'default_flow_lpm', min: 0, max: 100000 }),
    new NumberField({ name: 'retention_days', min: 0, max: 365 }),
  );
  return app.save(settings);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('sensors'));
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.removeByName('layout_rows');
  crops.fields.removeByName('layout_cols');
  app.save(crops);
  const settings = app.findCollectionByNameOrId('user_settings');
  for (const name of ['timezone', 'unit_volume', 'unit_temp', 'default_humidity_min', 'default_humidity_max', 'default_max_irrigation_minutes', 'default_min_rest_minutes', 'default_flow_lpm', 'retention_days']) {
    settings.fields.removeByName(name);
  }
  return app.save(settings);
});
