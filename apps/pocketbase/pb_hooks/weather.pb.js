/// <reference path="../pb_data/types.d.ts" />

// Cada 30 minutos actualiza el pronóstico de los cultivos que activaron "no regar si se espera lluvia".
cronAdd('rain-forecast', '*/30 * * * *', () => {
  try {
    const weather = require(`${__hooks}/weather.js`);
    const crops = $app.findRecordsByFilter('crops', 'rain_skip = true', '', 0, 0);
    for (const crop of crops) {
      try {
        weather.refresh($app, crop);
      } catch (error) {
        console.error(`Pronóstico de lluvia no disponible para el cultivo ${crop.id}:`, String(error));
      }
    }
  } catch (error) {
    console.error('rain-forecast falló:', String(error));
  }
});

// El dueño del cultivo puede pedir el pronóstico al instante (al guardar la ubicación).
routerAdd('POST', '/api/neptuno/crops/{id}/rain-forecast', (event) => {
  const weather = require(`${__hooks}/weather.js`);
  if (!event.auth) throw new UnauthorizedError('Inicia sesión.');
  const crop = $app.findRecordById('crops', event.request.pathValue('id'));
  if (crop.get('userId') !== event.auth.id) throw new ForbiddenError('Este cultivo no es tuyo.');
  try {
    const mm = weather.refresh($app, crop);
    return event.json(200, { mm, at: crop.get('rain_forecast_at') });
  } catch (error) {
    throw new BadRequestError(`No se pudo consultar el pronóstico: ${String(error)}`);
  }
});
