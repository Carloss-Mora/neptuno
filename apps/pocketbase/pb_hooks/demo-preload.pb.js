/// <reference path="../pb_data/types.d.ts" />

// Carga la demostración en la cuenta principal (y en la cuenta de invitados, si existe).
// Se hace en segundo plano cada minuto y NUNCA durante un inicio de sesión, para no interferir con el acceso.
// Los handlers de PocketBase son aislados: sin helpers a nivel de archivo.
cronAdd('demo-preload', '* * * * *', () => {
  try {
    const preload = require(`${__hooks}/demo-preload.js`);
    preload.ensureGuest($app);
    for (const user of $app.findRecordsByFilter('users', 'verified = true', '', 0, 0)) {
      preload.run($app, user);
    }
  } catch (error) {
    console.error('Demo preload cron failed:', error);
  }
});
