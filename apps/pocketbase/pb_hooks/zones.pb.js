/// <reference path="../pb_data/types.d.ts" />

// Límites de las zonas de un cultivo y riego manual por zona (los handlers son aislados: sin helpers de archivo).
onRecordCreateRequest((e) => {
  const zoneControl = require(`${__hooks}/zone-control.js`);
  const cropId = String(e.record.get('cropId'));
  const existing = zoneControl.list($app, cropId);
  if (existing.length >= zoneControl.MAX_ZONES) {
    throw new BadRequestError(`Un cultivo admite como máximo ${zoneControl.MAX_ZONES} zonas.`);
  }
  const channel = Number(e.record.get('valve_channel'));
  if (existing.some((zone) => Number(zone.get('valve_channel')) === channel)) {
    throw new BadRequestError(`El canal de válvula ${channel} ya lo usa otra zona de este cultivo.`);
  }
  e.next();
}, 'zones');

onRecordUpdateRequest((e) => {
  const zoneControl = require(`${__hooks}/zone-control.js`);
  const channel = Number(e.record.get('valve_channel'));
  const others = zoneControl.list($app, String(e.record.get('cropId'))).filter((zone) => zone.id !== e.record.id);
  if (others.some((zone) => Number(zone.get('valve_channel')) === channel)) {
    throw new BadRequestError(`El canal de válvula ${channel} ya lo usa otra zona de este cultivo.`);
  }
  e.next();
}, 'zones');

// Una zona solo puede tener sensores del mismo cultivo.
onRecordUpdateRequest((e) => {
  const zoneId = String(e.record.get('zoneId') || '');
  if (zoneId) {
    const zone = $app.findRecordById('zones', zoneId);
    if (String(zone.get('cropId')) !== String(e.record.get('cropId'))) {
      throw new BadRequestError('La zona pertenece a otro cultivo.');
    }
  }
  e.next();
}, 'sensors');

onRecordCreateRequest((e) => {
  const zoneId = String(e.record.get('zoneId') || '');
  if (zoneId) {
    const zone = $app.findRecordById('zones', zoneId);
    if (String(zone.get('cropId')) !== String(e.record.get('cropId'))) {
      throw new BadRequestError('La zona pertenece a otro cultivo.');
    }
  }
  e.next();
}, 'sensors');

// Riego manual de una sola zona.
routerAdd('POST', '/api/neptuno/zones/{id}/irrigation', (e) => {
  const zoneControl = require(`${__hooks}/zone-control.js`);
  const status = String((e.requestInfo().body || {}).status || '');
  if (status !== 'ON' && status !== 'OFF') throw new BadRequestError('El estado debe ser ON u OFF.');
  const zone = $app.findRecordById('zones', e.request.pathValue('id'));
  if (String(zone.get('userId')) !== String(e.auth.id)) throw new ForbiddenError('La zona no pertenece al usuario autenticado.');

  let zoneLog = null;
  let manualOverrideUntil = '';
  $app.runInTransaction((txApp) => {
    const crop = txApp.findRecordById('crops', zone.get('cropId'));
    if (crop.get('control_mode') === 'AUTO') {
      const minutes = Math.max(1, Number(crop.get('manual_override_minutes')) || 30);
      manualOverrideUntil = new Date(Date.now() + minutes * 60000).toISOString();
      crop.set('manual_override_until', manualOverrideUntil);
      txApp.save(crop);
    }
    zoneLog = new Record(txApp.findCollectionByNameOrId('irrigation_logs'), {
      userId: e.auth.id,
      cropId: crop.id,
      zoneId: zone.id,
      status,
      source: 'MANUAL',
    });
    txApp.save(zoneLog);

    // El registro del cultivo completo refleja si alguna zona está regando.
    const states = zoneControl.states(txApp, crop.id);
    const anyOn = states.some((item) => item.state === 'ON');
    const cropLogs = txApp.findRecordsByFilter('irrigation_logs', 'cropId = {:cropId} && zoneId = ""', '-created', 1, 0, { cropId: crop.id });
    const cropOn = cropLogs[0] && cropLogs[0].get('status') === 'ON';
    if (anyOn !== Boolean(cropOn)) {
      txApp.save(new Record(txApp.findCollectionByNameOrId('irrigation_logs'), {
        userId: e.auth.id,
        cropId: crop.id,
        status: anyOn ? 'ON' : 'OFF',
        source: 'MANUAL',
      }));
    }
  });
  return e.json(201, { log: zoneLog.publicExport(), manual_override_until: manualOverrideUntil });
}, $apis.requireAuth());
