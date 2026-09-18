/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('irrigation_logs');
  collection.fields.add(new TextField({
    name: 'source',
    max: 20,
  }));
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('irrigation_logs');
  collection.fields.removeByName('source');
  return app.save(collection);
});