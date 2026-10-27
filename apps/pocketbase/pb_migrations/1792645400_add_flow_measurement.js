/// <reference path="../pb_data/types.d.ts" />

// Caudal medido por el dispositivo (sensor de flujo opcional) para detectar fugas y obstrucciones.
migrate((app) => {
  const devices = app.findCollectionByNameOrId('devices');
  devices.fields.add(
    new NumberField({ name: 'last_flow_lpm', min: 0 }),
    new DateField({ name: 'last_flow_at' }),
  );
  devices.updateRule = `${devices.updateRule} && @request.body.last_flow_lpm:isset = false && @request.body.last_flow_at:isset = false`;
  return app.save(devices);
}, (app) => {
  const devices = app.findCollectionByNameOrId('devices');
  devices.fields.removeByName('last_flow_lpm');
  devices.fields.removeByName('last_flow_at');
  devices.updateRule = String(devices.updateRule).replace(' && @request.body.last_flow_lpm:isset = false && @request.body.last_flow_at:isset = false', '');
  return app.save(devices);
});
