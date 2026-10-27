/// <reference path="../pb_data/types.d.ts" />

// Ubicación del cultivo y opción "no regar si se espera lluvia" (pronóstico de Open-Meteo).
migrate((app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.add(
    new NumberField({ name: 'latitude', min: -90, max: 90 }),
    new NumberField({ name: 'longitude', min: -180, max: 180 }),
    new BoolField({ name: 'rain_skip' }),
    new NumberField({ name: 'rain_threshold_mm', min: 0, max: 200 }),
    new NumberField({ name: 'rain_forecast_mm', min: 0 }),
    new DateField({ name: 'rain_forecast_at' }),
  );
  app.save(crops);
}, (app) => {
  const crops = app.findCollectionByNameOrId('crops');
  ['latitude', 'longitude', 'rain_skip', 'rain_threshold_mm', 'rain_forecast_mm', 'rain_forecast_at'].forEach((name) => crops.fields.removeByName(name));
  return app.save(crops);
});
