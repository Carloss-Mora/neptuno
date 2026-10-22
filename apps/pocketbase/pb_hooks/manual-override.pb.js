/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((event) => {
  const log = event.record;
  if (!log || log.get('source') !== 'MANUAL' || !log.get('cropId')) return;

  try {
    const crop = $app.findRecordById('crops', log.get('cropId'));
    if (crop.get('control_mode') !== 'AUTO') return;

    const minutes = Number(crop.get('manual_override_minutes')) || 30;
    crop.set('manual_override_until', new Date(Date.now() + minutes * 60000).toISOString());
    $app.save(crop);
  } catch (error) {
    console.error(`Could not set manual override for irrigation log ${log.id}:`, error);
  }
}, 'irrigation_logs');
