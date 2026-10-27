/// <reference path="../pb_data/types.d.ts" />

// Minutos por día que se regaría con un horario fijo habitual: base para calcular el ahorro de agua.
migrate((app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.add(new NumberField({ name: 'reference_minutes_per_day', min: 0, max: 1440 }));
  return app.save(crops);
}, (app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.removeByName('reference_minutes_per_day');
  return app.save(crops);
});
