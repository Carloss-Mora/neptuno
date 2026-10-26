/// <reference path="../pb_data/types.d.ts" />

// Registra si el correo con el código OTP salió o falló, y lo expone a la web.
onMailerRecordOTPSend((e) => {
  const otpId = String((e.meta && e.meta.otpId) || '');
  const store = (status, reason, detail) => {
    if (!otpId) return;
    try {
      $app.save(new Record($app.findCollectionByNameOrId('otp_deliveries'), {
        otpId,
        status,
        reason,
        detail: String(detail || '').slice(0, 500),
      }));
    } catch (err) {
      console.error('No se pudo guardar el estado del OTP:', err);
    }
  };
  try {
    e.next();
    store('sent', '', '');
  } catch (error) {
    const text = String((error && error.message) || error);
    const reason = /Falta la configuraci/.test(text)
      ? 'not_configured'
      : /No se pudo enviar el correo/.test(text)
        ? 'provider_rejected'
        : $app.settings().smtp.enabled ? 'smtp_failed' : 'unknown';
    console.error('Fallo el envío del código OTP:', text);
    store('failed', reason, text);
    throw error;
  }
}, 'users');

routerAdd('GET', '/api/neptuno/auth/otp-status', (e) => {
  const otpId = String(e.request.url.query().get('otpId') || '');
  if (!/^[a-z0-9]{10,40}$/.test(otpId)) throw new BadRequestError('otpId no válido.');
  const rows = $app.findRecordsByFilter('otp_deliveries', 'otpId = {:otpId}', '', 1, 0, { otpId });
  if (rows.length === 0) return e.json(200, { status: 'pending' });
  return e.json(200, { status: rows[0].get('status'), reason: rows[0].get('reason') || '' });
});

// Limpieza diaria de estados de más de 7 días.
cronAdd('otpDeliveriesCleanup', '17 3 * * *', () => {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ');
  try {
    $app.db().newQuery('DELETE FROM otp_deliveries WHERE created < {:cutoff}').bind({ cutoff }).execute();
  } catch (err) {
    console.error('No se pudo limpiar otp_deliveries:', err);
  }
});
