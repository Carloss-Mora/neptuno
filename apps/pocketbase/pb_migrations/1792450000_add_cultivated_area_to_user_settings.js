/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('user_settings');
  collection.fields.add(new NumberField({
    name: 'cultivated_area_m2',
    min: 0,
  }));
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('user_settings');
  collection.fields.removeByName('cultivated_area_m2');
  return app.save(collection);
});
