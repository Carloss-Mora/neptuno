/// <reference path="../pb_data/types.d.ts" />

// Alertas por WhatsApp (opcionales). Los handlers de PocketBase son aislados: sin helpers a nivel de archivo.

routerAdd('GET', '/api/neptuno/whatsapp/status', (e) => {
  const whatsapp = require(`${__hooks}/whatsapp.js`);
  return e.json(200, { available: whatsapp.configured(), provider: whatsapp.provider(), needs_api_key: whatsapp.needsApiKey() });
}, $apis.requireAuth());

// Mensaje de prueba inmediato al número guardado.
routerAdd('POST', '/api/neptuno/whatsapp/test', (e) => {
  const whatsapp = require(`${__hooks}/whatsapp.js`);
  if (!whatsapp.configured()) throw new BadRequestError('WhatsApp no está configurado en el servidor todavía.');
  const settings = $app.findRecordsByFilter('user_settings', 'userId = {:userId}', '', 1, 0, { userId: e.auth.id });
  if (settings.length === 0 || !whatsapp.normalizePhone(settings[0].get('whatsapp_phone'))) {
    throw new BadRequestError('Guarda primero tu número de celular.');
  }
  try {
    whatsapp.send(settings[0], 'Neptuno: mensaje de prueba. Si lo ves, las alertas por WhatsApp están funcionando.');
  } catch (error) {
    throw new BadRequestError(`No se pudo enviar el mensaje: ${String((error && error.message) || error)}`);
  }
  return e.json(200, { ok: true });
}, $apis.requireAuth());

// Valida el número al guardar y lo deja normalizado (solo dígitos con indicativo).
onRecordCreateRequest((e) => {
  require(`${__hooks}/whatsapp.js`).validateSettings(e.record);
  e.next();
}, 'user_settings');
onRecordUpdateRequest((e) => {
  require(`${__hooks}/whatsapp.js`).validateSettings(e.record);
  e.next();
}, 'user_settings');
