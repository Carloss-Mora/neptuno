/// <reference path="../pb_data/types.d.ts" />

cronAdd('device-watchdog', '* * * * *', () => {
  const devices = $app.findAllRecords('devices');
  const logsCollection = $app.findCollectionByNameOrId('irrigation_logs');
  const now = Date.now();

  for (const device of devices) {
    if (device.get('is_simulated') === true) continue;
    const lastSeen = device.get('last_seen') ? new Date(device.get('last_seen')).getTime() : 0;
    const offlineAfterMs = Math.max(2 * Math.max(1, Number(device.get('interval_seconds')) || 15), 60) * 1000;
    if (!lastSeen || now - lastSeen <= offlineAfterMs) continue;

    const crop = $app.findRecordById('crops', device.get('cropId'));
    if (String(device.get('userId')) !== String(crop.get('userId'))) {
      console.error(`Device ${device.id} user/crop ownership mismatch; watchdog skipped.`);
      continue;
    }

    if (String(device.get('last_alert_code') || '') !== 'device_offline') {
      device.set('last_alert_code', 'device_offline');
      try {
        const queueNotification = require(`${__hooks}/notification-queue.js`);
        queueNotification(
          $app,
          device.get('userId'),
          crop.id,
          'alert',
          'Dispositivo sin conexión en Neptuno',
          `El dispositivo ${device.get('name')} dejó de enviar lecturas.`,
        );
      } catch (error) {
        console.error(`Could not queue offline alert for device ${device.id}:`, error);
      }
    }

    if (String(device.get('desired_state') || 'OFF') === 'ON') {
      const activeLogs = $app.findRecordsByFilter(
        logsCollection,
        'cropId = {:cropId} && zoneId = ""',
        '-created',
        1,
        0,
        { cropId: crop.id },
      );
      const activeLog = activeLogs[0];
      if (activeLog?.get('status') === 'ON' && ['THRESHOLD', 'SCHEDULE', 'PULSE'].includes(String(activeLog.get('source')))) {
        $app.save(new Record(logsCollection, {
          userId: crop.get('userId'),
          cropId: crop.id,
          status: 'OFF',
          source: 'WATCHDOG',
          deviceId: device.id,
          is_demo: device.get('is_demo'),
        }));
        require(`${__hooks}/zone-control.js`).mirror($app, crop, 'OFF', 'WATCHDOG', device.id, device.get('is_demo'));
      }
      device.set('desired_state', 'OFF');
    }

    $app.save(device);
  }
});
