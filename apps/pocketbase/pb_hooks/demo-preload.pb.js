/// <reference path="../pb_data/types.d.ts" />

// Carga la demostración en la cuenta principal la primera vez que entra (o al arrancar, si ya existe).
// Los handlers de PocketBase son aislados: sin helpers a nivel de archivo.
onRecordAuthRequest((e) => {
  try {
    require(`${__hooks}/demo-preload.js`).run($app, e.record);
  } catch (error) {
    console.error('Demo preload failed:', error);
  }
  e.next();
}, 'users');

cronAdd('demo-preload', '* * * * *', () => {
  try {
    const preload = require(`${__hooks}/demo-preload.js`);
    for (const user of $app.findRecordsByFilter('users', 'verified = true', '', 0, 0)) {
      preload.run($app, user);
    }
  } catch (error) {
    console.error('Demo preload cron failed:', error);
  }
});
