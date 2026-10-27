// Precarga de la demostración para la cuenta principal: cultivo de fresa, 30 días de datos y laboratorio de simulación.
// Se ejecuta una sola vez (deja una marca en pb_data) y no vuelve a cargar nada si luego se borran los datos de ejemplo.
// Cuenta: variable NEPTUNO_DEMO_PRELOAD_EMAILS (correos separados por coma). Para desactivarla: NEPTUNO_DEMO_PRELOAD_EMAILS=none.

const DEFAULT_EMAILS = 'carloz1mora2005@gmail.com';
const CROP_NAME = 'Fresas · Finca demostración';

function emails() {
  const raw = String($os.getenv('NEPTUNO_DEMO_PRELOAD_EMAILS') || '').trim();
  if (raw.toLowerCase() === 'none') return [];
  return (raw || DEFAULT_EMAILS).split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function markerPath(userId) {
  return `${$app.dataDir()}/demo-preload-${userId}.done`;
}

module.exports = {
  run(app, user) {
    if (!user || !emails().includes(String(user.get('email')).toLowerCase())) return false;
    const marker = markerPath(user.id);
    try { $os.stat(marker); return false; } catch (error) { /* aún no se ha cargado */ }

    const store = require(`${__hooks}/demo-store.js`);
    let crops = app.findRecordsByFilter('crops', 'userId = {:userId}', 'created', 1, 0, { userId: user.id });
    let crop = crops[0];
    if (!crop) {
      crop = new Record(app.findCollectionByNameOrId('crops'), {
        userId: user.id,
        name: CROP_NAME,
        control_mode: 'AUTO',
        growing_environment: 'greenhouse',
        humidity_min: 60,
        humidity_max: 80,
        max_irrigation_minutes: 20,
        min_rest_minutes: 120,
        manual_override_minutes: 30,
        alert_water_min: 20,
      });
      app.save(crop);
    }
    store.seed(app, crop, 30, true);

    try {
      const engine = require(`${__hooks}/simulation-engine.js`);
      const existing = app.findRecordsByFilter('simulations', 'cropId = {:cropId}', '', 1, 0, { cropId: crop.id });
      if (existing.length === 0) {
        const defaults = engine.defaultsFor(crop);
        app.runInTransaction((tx) => {
          const device = new Record(tx.findCollectionByNameOrId('devices'), {
            userId: user.id, cropId: crop.id, name: `Simulador · ${CROP_NAME}`,
            key_hash: $security.sha256($security.randomString(64)), interval_seconds: 300,
            desired_state: 'OFF', is_demo: true, is_simulated: true,
          });
          tx.save(device);
          tx.save(new Record(tx.findCollectionByNameOrId('simulations'), {
            userId: user.id, cropId: crop.id, deviceId: device.id, status: 'paused', fault: 'none',
            humidity: defaults.humidity, temperature: defaults.temperature, water_level: defaults.water_level,
            step_minutes: defaults.step_minutes, sim_time_ms: Date.now(), ticks: 0,
          }));
        });
      }
    } catch (error) {
      console.error('Demo preload: no se pudo crear el laboratorio de simulación:', error);
    }

    $os.writeFile(marker, new Date().toISOString(), 0o644);
    return true;
  },
};
