/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.add(new DateField({ name: 'planting_date' }));
  return app.save(crops);
}, (app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.removeByName('planting_date');
  return app.save(crops);
});
