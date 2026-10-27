/// <reference path="../pb_data/types.d.ts" />

// Constancia de que la persona aceptó los términos y la política de privacidad al crear su cuenta.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  users.fields.add(new DateField({ name: 'terms_accepted_at' }));
  return app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId('users');
  users.fields.removeByName('terms_accepted_at');
  return app.save(users);
});
