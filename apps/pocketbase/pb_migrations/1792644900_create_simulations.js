/// <reference path="../pb_data/types.d.ts" />

// Laboratorio de simulación: un cultivo virtual con su dispositivo simulado (is_simulated),
// separado de cualquier dispositivo físico. Solo se gestiona mediante rutas del servidor.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const crops = app.findCollectionByNameOrId('crops');
  const devices = app.findCollectionByNameOrId('devices');

  if (!devices.fields.getByName('is_simulated')) {
    devices.fields.add(new BoolField({ name: 'is_simulated' }));
    app.save(devices);
  }

  const simulations = new Collection({ name: 'simulations', type: 'base' });
  app.save(simulations);
  simulations.fields.add(
    new RelationField({ name: 'userId', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new RelationField({ name: 'cropId', collectionId: crops.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new RelationField({ name: 'deviceId', collectionId: devices.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new SelectField({ name: 'status', required: true, maxSelect: 1, values: ['running', 'paused'] }),
    new SelectField({ name: 'fault', required: true, maxSelect: 1, values: ['none', 'sensor_offline', 'invalid_reading', 'no_response'] }),
    new NumberField({ name: 'humidity', min: 0, max: 100 }),
    new NumberField({ name: 'temperature', min: -10, max: 60 }),
    new NumberField({ name: 'water_level', min: 0, max: 100 }),
    new NumberField({ name: 'step_minutes', min: 1, max: 60 }),
    new NumberField({ name: 'sim_time_ms' }),
    new NumberField({ name: 'on_since_ms' }),
    new NumberField({ name: 'off_since_ms' }),
    new NumberField({ name: 'offline_minutes', min: 0 }),
    new NumberField({ name: 'ticks', min: 0 }),
    new TextField({ name: 'last_state', max: 3 }),
    new TextField({ name: 'last_reason', max: 40 }),
    new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
    new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
  );
  simulations.indexes = ['CREATE UNIQUE INDEX idx_simulations_crop ON simulations (cropId)'];
  simulations.listRule = 'userId = @request.auth.id';
  simulations.viewRule = 'userId = @request.auth.id';
  app.save(simulations);

  const events = new Collection({ name: 'simulation_events', type: 'base' });
  app.save(events);
  events.fields.add(
    new RelationField({ name: 'simulationId', collectionId: simulations.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new RelationField({ name: 'userId', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new NumberField({ name: 'sim_time_ms' }),
    new NumberField({ name: 'humidity' }),
    new NumberField({ name: 'temperature' }),
    new NumberField({ name: 'water_level' }),
    new TextField({ name: 'state', max: 3 }),
    new TextField({ name: 'reason', max: 40 }),
    new TextField({ name: 'fault', max: 20 }),
    new TextField({ name: 'note', max: 200 }),
    new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
    new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
  );
  events.indexes = ['CREATE INDEX idx_simulation_events_sim ON simulation_events (simulationId, sim_time_ms)'];
  events.listRule = 'userId = @request.auth.id';
  events.viewRule = 'userId = @request.auth.id';
  app.save(events);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('simulation_events'));
  app.delete(app.findCollectionByNameOrId('simulations'));
  const devices = app.findCollectionByNameOrId('devices');
  devices.fields.removeByName('is_simulated');
  app.save(devices);
});
