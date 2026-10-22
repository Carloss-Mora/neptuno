/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((event) => {
  const log = event.record;
  if (!log || (log.get('status') !== 'ON' && log.get('status') !== 'OFF')) return;

  try {
    const user = $app.findRecordById('users', log.get('userId'));
    const statusMessage = log.get('status') === 'ON' ? 'El riego se ha iniciado.' : 'El riego ha finalizado.';
    const source = String(log.get('source') || 'MANUAL');
    $app.newMailClient().send(new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName || 'Neptuno',
      },
      to: [{ address: user.get('email') }],
      subject: 'Actualización del riego en Neptuno',
      text: `${statusMessage} Origen: ${source}.`,
      html: `<p>${statusMessage}</p><p>Origen: ${source}.</p>`,
    }));
  } catch (mailError) {
    console.error(`Could not send irrigation notification for log ${log.id}:`, mailError);
  }
}, 'irrigation_logs');
