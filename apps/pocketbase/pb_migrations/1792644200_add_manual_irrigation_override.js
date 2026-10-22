/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.add(
    new NumberField({ name: 'manual_override_minutes', min: 1, max: 1440 }),
    new DateField({ name: 'manual_override_until' }),
  );
  app.save(crops);
  for (const crop of app.findAllRecords(crops)) {
    crop.set('manual_override_minutes', 30);
    app.save(crop);
  }
}, (app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.removeByName('manual_override_minutes');
  crops.fields.removeByName('manual_override_until');
  return app.save(crops);
});
