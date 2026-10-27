// Consulta el pronóstico de lluvia de Open-Meteo (gratis, sin clave) y lo guarda en el cultivo.
module.exports = {
  refresh(app, crop, nowMs = Date.now()) {
    const guard = require(`${__hooks}/rain-guard.js`);
    if (!guard.hasLocation(crop)) return null;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${Number(crop.get('latitude'))}&longitude=${Number(crop.get('longitude'))}&hourly=precipitation&forecast_days=2&timezone=UTC`;
    const response = $http.send({ url, method: 'GET', timeout: 10 });
    if (response.statusCode !== 200) throw new Error(`Open-Meteo respondió ${response.statusCode}`);
    const hourly = response.json && response.json.hourly;
    if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.precipitation)) throw new Error('Respuesta inesperada de Open-Meteo');
    const mm = guard.sumNextHours(hourly.time, hourly.precipitation, nowMs, 6);
    if (mm === null) throw new Error('Open-Meteo no devolvió horas futuras');
    crop.set('rain_forecast_mm', mm);
    crop.set('rain_forecast_at', new Date(nowMs).toISOString());
    app.save(crop);
    return mm;
  },
};
