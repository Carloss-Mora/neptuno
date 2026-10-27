/// <reference path="../pb_data/types.d.ts" />

// Carga la demostración en la cuenta principal (verificada) como máximo un minuto después de que exista.
// Los handlers de PocketBase son aislados: sin helpers a nivel de archivo.
// La precarga corre en segundo plano (cada minuto), nunca dentro de una petición de inicio de sesión.
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
