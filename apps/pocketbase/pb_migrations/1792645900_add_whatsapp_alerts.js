/// <reference path="../pb_data/types.d.ts" />

// Alertas por WhatsApp (opcionales): cada persona decide si las quiere y registra su celular.
migrate((app) => {
  const settings = app.findCollectionByNameOrId('user_settings');
  settings.fields.add(
    new BoolField({ name: 'whatsapp_enabled' }),
    new TextField({ name: 'whatsapp_phone', max: 20 }),
    new TextField({ name: 'whatsapp_apikey', max: 80 }),
  );
  return app.save(settings);
}, (app) => {
  const settings = app.findCollectionByNameOrId('user_settings');
  settings.fields.removeByName('whatsapp_enabled');
  settings.fields.removeByName('whatsapp_phone');
  settings.fields.removeByName('whatsapp_apikey');
  return app.save(settings);
});
