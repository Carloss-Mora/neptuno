/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.add(
    new NumberField({ name: 'max_irrigation_minutes', min: 1, max: 1440 }),
    new NumberField({ name: 'min_rest_minutes', min: 0, max: 10080 }),
  );
  return app.save(crops);
}, (app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.removeByName('max_irrigation_minutes');
  crops.fields.removeByName('min_rest_minutes');
  return app.save(crops);
});
