/// <reference path="../pb_data/types.d.ts" />

// Guarda el resultado real del envío de cada código OTP. PocketBase responde 200 a
// request-otp aunque el correo falle (el envío ocurre en segundo plano), así que la web
// consulta esta tabla vía /api/neptuno/auth/otp-status para decir la verdad al usuario.
migrate((app) => {
  const collection = new Collection({ name: 'otp_deliveries', type: 'base' });
  app.save(collection);
  collection.fields.add(new TextField({ name: 'otpId', required: true, max: 64 }));
  collection.fields.add(new SelectField({ name: 'status', required: true, maxSelect: 1, values: ['sent', 'failed'] }));
  collection.fields.add(new TextField({ name: 'reason', max: 40 }));
  collection.fields.add(new TextField({ name: 'detail', max: 500, hidden: true }));
  collection.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }));
  collection.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }));
  collection.indexes = ['CREATE UNIQUE INDEX idx_otp_deliveries_otp_id ON otp_deliveries (otpId)'];
  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('otp_deliveries'));
});
