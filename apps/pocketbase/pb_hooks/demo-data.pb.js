/// <reference path="../pb_data/types.d.ts" />

// Datos de ejemplo para mostrar Neptuno funcionando sin hardware (por ejemplo en una exposición).
// Todo queda marcado como demostración (is_demo) y se puede borrar con un clic.
// Los handlers de PocketBase son aislados: sin helpers a nivel de archivo.

routerAdd('POST', '/api/neptuno/demo/history', (e) => {
  const store = require(`${__hooks}/demo-store.js`);
  const body = e.requestInfo().body || {};
  const crop = $app.findRecordById('crops', String(body.cropId || ''));
  if (String(crop.get('userId')) !== String(e.auth.id)) {
    throw new ForbiddenError('El cultivo no pertenece al usuario autenticado.');
  }
  const counts = store.seed($app, crop, Number(body.days) || 30, body.live !== false);
  return e.json(200, { ok: true, ...counts, live: body.live !== false });
}, $apis.requireAuth());

routerAdd('DELETE', '/api/neptuno/demo/history', (e) => {
  const store = require(`${__hooks}/demo-store.js`);
  const crop = $app.findRecordById('crops', String(e.requestInfo().query.cropId || ''));
  if (String(crop.get('userId')) !== String(e.auth.id)) {
    throw new ForbiddenError('El cultivo no pertenece al usuario autenticado.');
  }
  store.clear($app, crop.id);
  crop.set('demo_live', false);
  crop.set('demo_state', null);
  $app.save(crop);
  return e.json(200, { ok: true });
}, $apis.requireAuth());

cronAdd('demo-data-live', '*/5 * * * *', () => {
  const store = require(`${__hooks}/demo-store.js`);
  let crops = [];
  try {
    crops = $app.findRecordsByFilter('crops', 'demo_live = true', '', 0, 0);
  } catch (error) {
    return;
  }
  for (const crop of crops) {
    try {
      store.tick($app, crop);
    } catch (error) {
      console.error(`Demo live tick failed for crop ${crop.id}:`, error);
    }
  }
});
