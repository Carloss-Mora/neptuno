/// <reference path="../pb_data/types.d.ts" />

// Riego por pulsos: minutos regando y minutos de pausa (0 = desactivado). La simulación recuerda el ciclo.
migrate((app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.add(
    new NumberField({ name: 'pulse_on_minutes', min: 0, max: 1440 }),
    new NumberField({ name: 'pulse_off_minutes', min: 0, max: 1440 }),
  );
  app.save(crops);
  const sims = app.findCollectionByNameOrId('simulations');
  sims.fields.add(
    new BoolField({ name: 'pulse_cycle' }),
    new NumberField({ name: 'cycle_on_ms' }),
  );
  app.save(sims);
}, (app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.removeByName('pulse_on_minutes');
  crops.fields.removeByName('pulse_off_minutes');
  app.save(crops);
  const sims = app.findCollectionByNameOrId('simulations');
  sims.fields.removeByName('pulse_cycle');
  sims.fields.removeByName('cycle_on_ms');
  return app.save(sims);
});
