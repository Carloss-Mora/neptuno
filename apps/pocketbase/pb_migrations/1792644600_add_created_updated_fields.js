/// <reference path="../pb_data/types.d.ts" />

// Las colecciones creadas con `new Collection(...)` desde una migración NO incluyen los
// campos created/updated (en PocketBase 0.23+ hay que declararlos). Sin ellos, cualquier
// consulta con sort por created responde 400 y el cron de correos no puede ordenar su cola.
// Regla: toda migración que cree una colección debe añadir también created y updated.
const COLLECTIONS = [
  'crops',
  'irrigation_schedules',
  'devices',
  'notification_queue',
  'notification_deliveries',
  'sensor_readings_hourly',
];

migrate((app) => {
  const now = new Date().toISOString().replace('T', ' ');
  for (const name of COLLECTIONS) {
    const collection = app.findCollectionByNameOrId(name);
    if (!collection.fields.getByName('created')) {
      collection.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }));
    }
    if (!collection.fields.getByName('updated')) {
      collection.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }));
    }
    app.save(collection);
    app.db()
      .newQuery(`UPDATE ${name} SET created = {:now}, updated = {:now} WHERE created = '' OR created IS NULL`)
      .bind({ now })
      .execute();
  }
}, (app) => {
  for (const name of COLLECTIONS) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.removeByName('created');
    collection.fields.removeByName('updated');
    app.save(collection);
  }
});
