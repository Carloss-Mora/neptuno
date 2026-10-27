/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.add(new SelectField({ name: 'growing_environment', values: ['open_air', 'greenhouse'], maxSelect: 1 }));
  return app.save(crops);
}, (app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.removeByName('growing_environment');
  return app.save(crops);
});
