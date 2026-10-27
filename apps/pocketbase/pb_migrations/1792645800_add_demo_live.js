/// <reference path="../pb_data/types.d.ts" />

// Datos de ejemplo "en vivo": el estado del simulador se guarda en el cultivo para seguir cada 5 minutos.
migrate((app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.add(
    new BoolField({ name: 'demo_live' }),
    new JSONField({ name: 'demo_state', maxSize: 200000 }),
  );
  return app.save(crops);
}, (app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.removeByName('demo_live');
  crops.fields.removeByName('demo_state');
  return app.save(crops);
});
