module.exports = (app, userId, cropId, kind, subject, message) => {
  let user;
  try {
    user = app.findRecordById('users', userId);
  } catch (error) {
    if (String(error?.message || '').includes('no rows in result set')) return false;
    throw error;
  }
  if (!user) return false;

  const settings = app.findRecordsByFilter(
    'user_settings',
    'userId = {:userId}',
    '',
    1,
    0,
    { userId },
  );
  const setting = settings[0] || null;
  const enabled = kind === 'irrigation'
    ? setting && setting.get('notify_irrigation_events') === true
    : !setting || setting.get('notify_alerts') !== false;
  if (!enabled) return false;

  // Sin correo configurado no tiene sentido encolar: nunca se entregaría.
  const smtpEnabled = app.settings().smtp.enabled === true;
  const apiConfigured = Boolean($os.getenv('BUILDER_MAILER_API_KEY') && $os.getenv('BUILDER_MAILER_SENDER_ADDRESS'));
  if (!smtpEnabled && !apiConfigured) {
    console.warn('Alerta por correo omitida: el correo del servidor no está configurado (ver README, "Configurar el correo").');
    return false;
  }

  app.save(new Record(app.findCollectionByNameOrId('notification_queue'), {
    userId,
    cropId,
    kind,
    subject,
    message,
  }));
  return true;
};
