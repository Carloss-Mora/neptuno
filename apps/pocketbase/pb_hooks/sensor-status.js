// Actualiza la última lectura de los sensores individuales de un cultivo.
//   reading: { soilHumidity, temperature, waterLevel }  (lectura general del dispositivo)
//   perSensor: { [sensorId]: valor } | null             (valores específicos de cada sensor)
// Si un sensor aparece en perSensor se usa ese valor; si no, el valor general de su tipo.
module.exports = {
  update(app, cropId, reading, perSensor, nowIso) {
    const sensors = app.findRecordsByFilter('sensors', 'cropId = {:cropId}', '', 50, 0, { cropId });
    const byKind = { soil_humidity: reading.soilHumidity, temperature: reading.temperature, water_level: reading.waterLevel };
    for (const sensor of sensors) {
      const own = perSensor && Object.prototype.hasOwnProperty.call(perSensor, sensor.id) ? perSensor[sensor.id] : undefined;
      const value = own !== undefined ? own : byKind[String(sensor.get('kind'))];
      if (!Number.isFinite(value)) continue;
      sensor.set('last_value', value);
      sensor.set('last_reading_at', nowIso);
      app.save(sensor);
    }
    return sensors.length;
  },
};
