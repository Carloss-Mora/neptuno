/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const devices = app.findCollectionByNameOrId('devices');
  devices.createRule = null;
  devices.updateRule = [
    'userId = @request.auth.id',
    'cropId.userId = @request.auth.id',
    '@request.body.userId:isset = false',
    '@request.body.cropId:isset = false',
    '@request.body.key_hash:isset = false',
    '@request.body.desired_state:isset = false',
    '@request.body.last_seen:isset = false',
    '@request.body.last_ingest_at:isset = false',
    '@request.body.last_alert_code:isset = false',
    '@request.body.last_alert_sent_at:isset = false',
    '@request.body.is_demo:isset = false',
  ].join(' && ');
  devices.indexes = [
    ...devices.indexes.filter((index) => !index.includes('idx_devices_key_hash')),
    'CREATE UNIQUE INDEX idx_devices_key_hash ON devices (key_hash)',
  ];
  return app.save(devices);
}, (app) => {
  const devices = app.findCollectionByNameOrId('devices');
  devices.createRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  devices.updateRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  devices.indexes = devices.indexes.filter((index) => !index.includes('idx_devices_key_hash'));
  return app.save(devices);
});
