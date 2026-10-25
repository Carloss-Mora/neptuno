/// <reference path="../pb_data/types.d.ts" />

cronAdd('notification-delivery', '* * * * *', () => {
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
  const MAX_ATTEMPTS = 5;
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const nowIso = new Date().toISOString().replace('T', ' ');
  const queue = $app.findRecordsByFilter(
    'notification_queue',
    "next_attempt_at = '' || next_attempt_at <= {:now}",
    'created',
    100,
    0,
    { now: nowIso },
  );
  for (const item of queue) {
    try {
      const user = $app.findRecordById('users', item.get('userId'));
      const cutoff = new Date(Date.now() - 30 * 60000).toISOString();
      const recentDeliveries = $app.findRecordsByFilter(
        'notification_deliveries',
        'userId = {:userId} && cropId = {:cropId} && kind = {:kind} && sent_at >= {:cutoff}',
        '-sent_at',
        1,
        0,
        {
          userId: item.get('userId'),
          cropId: item.get('cropId'),
          kind: item.get('kind'),
          cutoff,
        },
      );
      if (recentDeliveries.length > 0) {
        $app.delete(item);
        continue;
      }

      $app.newMailClient().send(new MailerMessage({
        from: {
          address: $app.settings().meta.senderAddress,
          name: $app.settings().meta.senderName || 'Neptuno',
        },
        to: [{ address: user.get('email') }],
        subject: item.get('subject'),
        text: item.get('message'),
        html: `<p>${escapeHtml(item.get('message'))}</p>`,
      }));
      $app.save(new Record($app.findCollectionByNameOrId('notification_deliveries'), {
        userId: item.get('userId'),
        cropId: item.get('cropId'),
        kind: item.get('kind'),
        sent_at: new Date().toISOString(),
      }));
      $app.delete(item);
    } catch (error) {
      if (String(error?.message || '').includes('no rows in result set')) {
        $app.delete(item);
        continue;
      }
      const attempts = Number(item.get('attempts') || 0) + 1;
      const detail = String((error && error.message) || error).slice(0, 500);
      const createdAt = new Date(String(item.get('created')).replace(' ', 'T')).getTime();
      const tooOld = Number.isFinite(createdAt) && Date.now() - createdAt > MAX_AGE_MS;
      try {
        if (attempts >= MAX_ATTEMPTS || tooOld) {
          console.error(`Notificación ${item.id} descartada tras ${attempts} intentos: ${detail}`);
          $app.delete(item);
        } else {
          const waitMinutes = Math.pow(2, attempts);
          item.set('attempts', attempts);
          item.set('last_error', detail);
          item.set('next_attempt_at', new Date(Date.now() + waitMinutes * 60000).toISOString());
          $app.save(item);
          console.error(`Notificación ${item.id} falló (intento ${attempts}); se reintenta en ${waitMinutes} min: ${detail}`);
        }
      } catch (bookkeepingError) {
        console.error(`No se pudo actualizar la notificación ${item.id}:`, bookkeepingError);
      }
    }
  }
});
