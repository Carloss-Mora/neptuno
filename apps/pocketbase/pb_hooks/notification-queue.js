// Canales por los que se avisa a una persona según sus preferencias y lo que el servidor tiene configurado.
const channelsFor = (app, userId, kind) => {
  const whatsapp = require(`${__hooks}/whatsapp.js`);
  const settings = app.findRecordsByFilter('user_settings', 'userId = {:userId}', '', 1, 0, { userId });
  const setting = settings[0] || null;
  const emailWanted = kind === 'irrigation'
    ? Boolean(setting && setting.get('notify_irrigation_events') === true)
    : !setting || setting.get('notify_alerts') !== false;
  // Sin correo configurado no tiene sentido enviarlo: nunca se entregaría.
  const smtpEnabled = app.settings().smtp.enabled === true;
  const apiConfigured = Boolean($os.getenv('BUILDER_MAILER_API_KEY') && $os.getenv('BUILDER_MAILER_SENDER_ADDRESS'));
  // WhatsApp solo para alertas importantes y solo si la persona lo activó y dejó su número.
  const whatsappWanted = kind === 'alert' && Boolean(setting && setting.get('whatsapp_enabled') === true && whatsapp.normalizePhone(setting.get('whatsapp_phone')));
  return {
    email: emailWanted && (smtpEnabled || apiConfigured),
    whatsapp: whatsappWanted && whatsapp.configured(),
    emailWanted,
    setting,
  };
};

const queueNotification = (app, userId, cropId, kind, subject, message) => {
  let user;
  try {
    user = app.findRecordById('users', userId);
  } catch (error) {
    if (String(error?.message || '').includes('no rows in result set')) return false;
    throw error;
  }
  if (!user) return false;

  const channels = channelsFor(app, userId, kind);
  if (!channels.email && !channels.whatsapp) {
    if (channels.emailWanted) console.warn('Alerta por correo omitida: el correo del servidor no está configurado (ver README, "Configurar el correo").');
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

module.exports = queueNotification;
module.exports.channelsFor = channelsFor;
