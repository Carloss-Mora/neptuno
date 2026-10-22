/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const sensorReadings = app.findCollectionByNameOrId('sensor_readings');
  sensorReadings.createRule = 'userId = @request.auth.id';
  sensorReadings.updateRule = null;
  app.save(sensorReadings);

  const waterConsumption = app.findCollectionByNameOrId('water_consumption');
  waterConsumption.createRule = 'userId = @request.auth.id';
  waterConsumption.updateRule = null;
  app.save(waterConsumption);

  const userSettings = app.findCollectionByNameOrId('user_settings');
  userSettings.updateRule = 'userId = @request.auth.id && @request.body.userId = @request.auth.id';
  return app.save(userSettings);
}, (app) => {
  const sensorReadings = app.findCollectionByNameOrId('sensor_readings');
  sensorReadings.createRule = "@request.auth.id != ''";
  sensorReadings.updateRule = 'userId = @request.auth.id';
  app.save(sensorReadings);

  const waterConsumption = app.findCollectionByNameOrId('water_consumption');
  waterConsumption.createRule = "@request.auth.id != ''";
  waterConsumption.updateRule = 'userId = @request.auth.id';
  app.save(waterConsumption);

  const userSettings = app.findCollectionByNameOrId('user_settings');
  userSettings.updateRule = 'userId = @request.auth.id';
  return app.save(userSettings);
});
