/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.add(
    new NumberField({ name: 'alert_water_min', min: 0, max: 100 }),
    new NumberField({ name: 'alert_temp_max', min: -10, max: 60 }),
  );
  app.save(crops);

  const settings = app.findCollectionByNameOrId('user_settings');
  settings.fields.add(
    new BoolField({ name: 'notify_irrigation_events' }),
    new BoolField({ name: 'notify_alerts' }),
  );
  app.save(settings);
  for (const record of app.findAllRecords(settings)) {
    record.set('notify_irrigation_events', false);
    record.set('notify_alerts', true);
    app.save(record);
  }

  const users = app.findCollectionByNameOrId('users');
  const cropsCollection = app.findCollectionByNameOrId('crops');
  const queue = new Collection({ name: 'notification_queue', type: 'base' });
  app.save(queue);
  queue.fields.add(
    new RelationField({ name: 'userId', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new RelationField({ name: 'cropId', collectionId: cropsCollection.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new SelectField({ name: 'kind', required: true, maxSelect: 1, values: ['irrigation', 'alert'] }),
    new TextField({ name: 'subject', required: true, max: 200 }),
    new TextField({ name: 'message', required: true, max: 4000 }),
  );
  app.save(queue);
  queue.listRule = null;
  queue.viewRule = null;
  queue.createRule = null;
  queue.updateRule = null;
  queue.deleteRule = null;
  app.save(queue);

  const deliveries = new Collection({ name: 'notification_deliveries', type: 'base' });
  app.save(deliveries);
  deliveries.fields.add(
    new RelationField({ name: 'userId', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new RelationField({ name: 'cropId', collectionId: cropsCollection.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new SelectField({ name: 'kind', required: true, maxSelect: 1, values: ['irrigation', 'alert'] }),
    new DateField({ name: 'sent_at', required: true }),
  );
  app.save(deliveries);
  deliveries.listRule = null;
  deliveries.viewRule = null;
  deliveries.createRule = null;
  deliveries.updateRule = null;
  deliveries.deleteRule = null;
  return app.save(deliveries);
}, (app) => {
  for (const name of ['notification_queue', 'notification_deliveries']) {
    app.delete(app.findCollectionByNameOrId(name));
  }
  const settings = app.findCollectionByNameOrId('user_settings');
  settings.fields.removeByName('notify_irrigation_events');
  settings.fields.removeByName('notify_alerts');
  app.save(settings);
  const crops = app.findCollectionByNameOrId('crops');
  crops.fields.removeByName('alert_water_min');
  crops.fields.removeByName('alert_temp_max');
  return app.save(crops);
});
