/// <reference path="../pb_data/types.d.ts" />

cronAdd('notification-delivery', '* * * * *', () => {
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
  const queue = $app.findRecordsByFilter('notification_queue', '', 'created', 100, 0);
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
      console.error(`Could not deliver notification ${item.id}:`, error);
    }
  }
});
