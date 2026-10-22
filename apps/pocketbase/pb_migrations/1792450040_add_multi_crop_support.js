/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const crops = new Collection({
    name: 'crops',
    type: 'base',
  });
  app.save(crops);
  crops.fields.add(
    new RelationField({ name: 'userId', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new TextField({ name: 'name', required: true, min: 1, max: 100 }),
    new TextField({ name: 'variety', max: 100 }),
    new NumberField({ name: 'area_m2', min: 0 }),
    new SelectField({
      name: 'phenological_stage',
      maxSelect: 1,
      values: ['vegetativo', 'floración', 'fructificación'],
    }),
    new NumberField({ name: 'humidity_min', min: 0, max: 100 }),
    new NumberField({ name: 'humidity_max', min: 0, max: 100 }),
    new SelectField({
      name: 'control_mode',
      required: true,
      maxSelect: 1,
      values: ['MANUAL', 'SCHEDULE', 'AUTO'],
    }),
  );
  app.save(crops);
  crops.listRule = 'userId = @request.auth.id';
  crops.viewRule = 'userId = @request.auth.id';
  crops.createRule = 'userId = @request.auth.id';
  crops.updateRule = 'userId = @request.auth.id';
  crops.deleteRule = 'userId = @request.auth.id';
  app.save(crops);

  const schedules = new Collection({
    name: 'irrigation_schedules',
    type: 'base',
  });
  app.save(schedules);
  schedules.fields.add(
    new RelationField({ name: 'userId', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new RelationField({ name: 'cropId', collectionId: crops.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new TextField({ name: 'date', max: 10 }),
    new TextField({ name: 'startTime', required: true, max: 5 }),
    new TextField({ name: 'endTime', max: 5 }),
    new TextField({ name: 'timeZone', max: 100 }),
    new NumberField({ name: 'utcOffsetMinutes', min: -720, max: 840 }),
    new JSONField({ name: 'days' }),
    new SelectField({ name: 'recurrence', required: true, maxSelect: 1, values: ['ONCE', 'DAILY', 'WEEKLY'] }),
  );
  app.save(schedules);
  schedules.listRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  schedules.viewRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  schedules.createRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  schedules.updateRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  schedules.deleteRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
  app.save(schedules);

  const settings = app.findCollectionByNameOrId('user_settings');
  const settingsByUser = new Map();
  for (const setting of app.findAllRecords(settings)) {
    const userId = String(setting.get('userId') || '');
    if (userId && !settingsByUser.has(userId)) settingsByUser.set(userId, setting);
  }

  const userIds = new Set(app.findAllRecords(users).map((user) => user.id));
  for (const collectionName of ['sensor_readings', 'irrigation_logs', 'water_consumption']) {
    const collection = app.findCollectionByNameOrId(collectionName);
    for (const record of app.findAllRecords(collection)) {
      const userId = String(record.get('userId') || '');
      if (userId) userIds.add(userId);
    }
  }

  const cropByUser = new Map();
  for (const userId of userIds) {
    try {
      app.findRecordById(users, userId);
    } catch {
      continue;
    }

    const setting = settingsByUser.get(userId);
    const existingArea = Number(setting?.get('cultivated_area_m2'));
    const crop = new Record(crops, {
      userId,
      name: 'Cultivo principal',
      area_m2: Number.isFinite(existingArea) && existingArea > 0 ? existingArea : null,
      phenological_stage: '',
      humidity_min: null,
      humidity_max: null,
      control_mode: 'MANUAL',
    });
    app.save(crop);
    cropByUser.set(userId, crop.id);

    const rawSchedules = String(setting?.get('irrigation_schedule_times') || '');
    let entries = [];
    if (rawSchedules) {
      try {
        const parsed = JSON.parse(rawSchedules);
        entries = Array.isArray(parsed) ? parsed : [];
      } catch {
        entries = rawSchedules.split(',').map((time) => ({ startTime: time.trim() }));
      }
    }

    for (const entry of entries) {
      const startTime = String(entry?.startTime || entry?.time || '').trim();
      const endTime = String(entry?.endTime || '').trim();
      if (!/^\d{2}:\d{2}$/.test(startTime)) continue;

      const date = String(entry.date || entry.startDate || '').trim();
      const days = Array.isArray(entry.days) ? entry.days : [];
      app.save(new Record(schedules, {
        userId,
        cropId: crop.id,
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
        startTime,
        endTime,
        timeZone: String(entry.timeZone || ''),
        utcOffsetMinutes: Number.isFinite(Number(entry.utcOffsetMinutes)) ? Number(entry.utcOffsetMinutes) : 0,
        days,
        recurrence: days.length > 0 ? 'WEEKLY' : 'ONCE',
      }));
    }
  }

  for (const collectionName of ['sensor_readings', 'irrigation_logs', 'water_consumption']) {
    const collection = app.findCollectionByNameOrId(collectionName);
    collection.fields.add(new RelationField({
      name: 'cropId',
      collectionId: crops.id,
      required: false,
      maxSelect: 1,
      cascadeDelete: true,
    }));
    app.save(collection);
    collection.listRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
    collection.viewRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
    collection.createRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
    collection.updateRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
    collection.deleteRule = 'userId = @request.auth.id && cropId.userId = @request.auth.id';
    app.save(collection);

    for (const record of app.findAllRecords(collection)) {
      const cropId = cropByUser.get(String(record.get('userId') || ''));
      if (!cropId) continue;
      record.set('cropId', cropId);
      app.save(record);
    }
  }

  settings.fields.removeByName('cultivated_area_m2');
  settings.fields.removeByName('irrigation_schedule_times');
  return app.save(settings);
}, (app) => {
  const crops = app.findCollectionByNameOrId('crops');
  const schedules = app.findCollectionByNameOrId('irrigation_schedules');
  const settings = app.findCollectionByNameOrId('user_settings');
  settings.fields.add(new TextField({ name: 'irrigation_schedule_times' }));
  settings.fields.add(new NumberField({ name: 'cultivated_area_m2', min: 0 }));

  const settingsByUser = new Map();
  for (const record of app.findAllRecords(settings)) {
    settingsByUser.set(String(record.get('userId') || ''), record);
  }
  for (const crop of app.findAllRecords(crops)) {
    const userId = String(crop.get('userId') || '');
    let setting = settingsByUser.get(userId);
    if (!setting) {
      setting = new Record(settings, { userId });
      settingsByUser.set(userId, setting);
    }
    setting.set('cultivated_area_m2', crop.get('area_m2'));
    const cropSchedules = app.findRecordsByFilter(
      schedules,
      'cropId = {:cropId}',
      'date,startTime',
      0,
      0,
      { cropId: crop.id },
    );
    setting.set('irrigation_schedule_times', JSON.stringify(cropSchedules.map((schedule) => ({
      id: schedule.id,
      date: schedule.get('date'),
      startTime: schedule.get('startTime'),
      endTime: schedule.get('endTime'),
      time: schedule.get('startTime'),
      days: schedule.get('days'),
      timeZone: schedule.get('timeZone'),
      utcOffsetMinutes: schedule.get('utcOffsetMinutes'),
    }))));
    app.save(setting);
  }

  for (const collectionName of ['sensor_readings', 'irrigation_logs', 'water_consumption']) {
    const collection = app.findCollectionByNameOrId(collectionName);
    for (const record of app.findAllRecords(collection)) record.set('cropId', '');
    collection.fields.removeByName('cropId');
    app.save(collection);
    collection.listRule = 'userId = @request.auth.id';
    collection.viewRule = 'userId = @request.auth.id';
    collection.createRule = 'userId = @request.auth.id';
    collection.updateRule = collectionName === 'sensor_readings' ? null : 'userId = @request.auth.id';
    collection.deleteRule = 'userId = @request.auth.id';
    app.save(collection);
  }

  for (const record of app.findAllRecords(schedules)) app.delete(record);
  app.delete(schedules);
  for (const record of app.findAllRecords(crops)) app.delete(record);
  app.delete(crops);
  return app.save(settings);
});
