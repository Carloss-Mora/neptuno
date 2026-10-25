/// <reference path="../pb_data/types.d.ts" />

// Reintentos con espera creciente para la cola de correos: sin esto un correo que falla
// se reintentaba cada minuto para siempre.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('notification_queue');
  if (!collection.fields.getByName('attempts')) {
    collection.fields.add(new NumberField({ name: 'attempts', min: 0, onlyInt: true }));
  }
  if (!collection.fields.getByName('last_error')) {
    collection.fields.add(new TextField({ name: 'last_error', max: 500 }));
  }
  if (!collection.fields.getByName('next_attempt_at')) {
    collection.fields.add(new DateField({ name: 'next_attempt_at' }));
  }
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('notification_queue');
  for (const name of ['attempts', 'last_error', 'next_attempt_at']) collection.fields.removeByName(name);
  app.save(collection);
});
