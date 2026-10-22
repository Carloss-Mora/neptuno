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

  app.save(new Record(app.findCollectionByNameOrId('notification_queue'), {
    userId,
    cropId,
    kind,
    subject,
    message,
  }));
  return true;
};
