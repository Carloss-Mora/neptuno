/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((event) => {
  const log = event.record;
  if (!log || (log.get('status') !== 'ON' && log.get('status') !== 'OFF')) return;
  // Las zonas se resumen en el aviso del cultivo completo: no se notifica cada válvula por separado.
  if (log.get('zoneId')) return;

  const statusMessage = log.get('status') === 'ON' ? 'El riego se ha iniciado.' : 'El riego ha finalizado.';
  const source = String(log.get('source') || 'MANUAL');
  const queueNotification = require(`${__hooks}/notification-queue.js`);
  try {
    queueNotification(
      $app,
      log.get('userId'),
      log.get('cropId'),
      'irrigation',
      'Actualización del riego en Neptuno',
      `${statusMessage} Origen: ${source}.`,
    );
  } catch (error) {
    console.error(`Could not queue irrigation notification for log ${log.id}:`, error);
  }
}, 'irrigation_logs');
