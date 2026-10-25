import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const baseUrl = (process.env.PB_URL || '').replace(/\/+$/, '');
const adminEmail = process.env.PB_ADMIN_EMAIL;
const adminPassword = process.env.PB_ADMIN_PASSWORD;
const mockMailUrl = (process.env.MOCK_MAIL_URL || '').replace(/\/+$/, '');
const slowMode = process.argv.includes('--slow');

if (!baseUrl || !adminEmail || !adminPassword) {
  console.error('Set PB_URL, PB_ADMIN_EMAIL, and PB_ADMIN_PASSWORD before running this smoke test.');
  process.exit(2);
}

const report = (label, error = null) => {
  console.log(`${error ? 'FAIL' : 'PASS'} ${label}${error ? ` — ${error.message}` : ''}`);
};

const request = async (path, { method = 'GET', body, token, deviceKey, headers = {} } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: token } : {}),
      ...(deviceKey ? { 'X-Device-Key': deviceKey } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
};

const expectStatus = (response, accepted, label) => {
  if (!accepted.includes(response.status)) {
    throw new Error(`${label}: expected ${accepted.join('/')} but got ${response.status} (${JSON.stringify(response.data)})`);
  }
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const id = randomUUID().replaceAll('-', '');
const password = `Np-${randomBytes(18).toString('hex')}!`;
const credentials = [
  { email: `neptuno-smoke-a-${id}@example.test`, password, name: 'E2E usuario A' },
  { email: `neptuno-smoke-b-${id}@example.test`, password, name: 'E2E usuario B' },
];
let adminToken = '';
const createdUserIds = [];

try {
  const adminAuth = await request('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: { identity: adminEmail, password: adminPassword },
  });
  expectStatus(adminAuth, [200], 'PocketBase superuser authentication');
  adminToken = adminAuth.data.token;

  const users = [];
  for (const user of credentials) {
    const created = await request('/api/collections/users/records', {
      method: 'POST',
      token: adminToken,
      body: { ...user, passwordConfirm: user.password, verified: true, emailVisibility: true },
    });
    expectStatus(created, [200, 201], 'Create verified smoke-test user');
    createdUserIds.push(created.data.id);
    const auth = await request('/api/collections/users/auth-with-password', {
      method: 'POST',
      body: { identity: user.email, password: user.password },
    });
    expectStatus(auth, [200], 'Authenticate smoke-test user');
    users.push({ id: created.data.id, token: auth.data.token });
  }

  const cropBody = (userId, name) => ({
    userId,
    name,
    control_mode: 'AUTO',
    humidity_min: 30,
    humidity_max: 60,
    max_irrigation_minutes: 30,
    min_rest_minutes: 0,
    manual_override_minutes: 30,
    alert_water_min: 20,
  });
  const cropAResponse = await request('/api/collections/crops/records', {
    method: 'POST', token: users[0].token, body: cropBody(users[0].id, 'Smoke crop A'),
  });
  expectStatus(cropAResponse, [200, 201], 'Create crop A');
  const cropBResponse = await request('/api/collections/crops/records', {
    method: 'POST', token: users[1].token, body: cropBody(users[1].id, 'Smoke crop B'),
  });
  expectStatus(cropBResponse, [200, 201], 'Create crop B');
  const cropA = cropAResponse.data;
  const cropB = cropBResponse.data;

  const deviceResponse = await request('/api/neptuno/devices', {
    method: 'POST',
    token: users[0].token,
    body: { cropId: cropA.id, name: 'Smoke device', interval_seconds: 2 },
  });
  expectStatus(deviceResponse, [201], 'Create device through authenticated route');
  const device = deviceResponse.data.device;
  let deviceKey = deviceResponse.data.key;
  if (!deviceKey || deviceKey.length < 64 || Object.hasOwn(device, 'key_hash')) {
    throw new Error('Device API did not return a one-time key without exposing key_hash.');
  }
  const listedDevices = await request(`/api/collections/devices/records/${device.id}`, { token: users[0].token });
  expectStatus(listedDevices, [200], 'Read own device');
  if (Object.hasOwn(listedDevices.data, 'key_hash')) throw new Error('Hidden device key hash was exposed to the user.');
  report('device creation returns a one-time key and hides key_hash');
  const rotatedKey = await request(`/api/neptuno/devices/${device.id}/rotate-key`, {
    method: 'POST',
    token: users[0].token,
    body: {},
  });
  expectStatus(rotatedKey, [200], 'Rotate an owned device key');
  if (Object.hasOwn(rotatedKey.data.device, 'key_hash')) throw new Error('Key rotation exposed key_hash.');
  const oldKeyResponse = await request('/api/neptuno/ingest', {
    method: 'POST', deviceKey, body: { soil_humidity: 10, temperature: 22, water_level: 80 },
  });
  expectStatus(oldKeyResponse, [401], 'Reject a rotated device key');
  deviceKey = rotatedKey.data.key;
  report('key rotation is owner-only, hides the hash, and invalidates the old key');

  const firstIngest = await request('/api/neptuno/ingest', {
    method: 'POST', deviceKey, body: { soil_humidity: 10, temperature: 22, water_level: 80, demo: true },
  });
  expectStatus(firstIngest, [200], 'Valid device ingestion');
  if (firstIngest.data.irrigation !== 'ON') throw new Error('Low humidity did not start automatic irrigation.');
  const noKey = await request('/api/neptuno/ingest', {
    method: 'POST', body: { soil_humidity: 10, temperature: 22, water_level: 80 },
  });
  const invalidKey = await request('/api/neptuno/ingest', {
    method: 'POST', deviceKey: 'invalid-key', body: { soil_humidity: 10, temperature: 22, water_level: 80 },
  });
  expectStatus(noKey, [401], 'Missing device key');
  expectStatus(invalidKey, [401], 'Invalid device key');
  report('valid ingestion succeeds; missing and invalid keys return 401');

  const logsResponse = await request(`/api/collections/irrigation_logs/records?filter=cropId%3D%22${cropA.id}%22&sort=-created`, { token: users[0].token });
  expectStatus(logsResponse, [200], 'Read own irrigation logs');
  if (!logsResponse.data.items.some((log) => log.source === 'THRESHOLD' && log.status === 'ON')) {
    throw new Error('AUTO did not create a THRESHOLD ON log.');
  }
  await sleep(1200);
  const hysteresis = await request('/api/neptuno/ingest', {
    method: 'POST', deviceKey, body: { soil_humidity: 40, temperature: 22, water_level: 80 },
  });
  if (hysteresis.data.irrigation !== 'ON') throw new Error('Hysteresis did not hold ON between thresholds.');
  await sleep(1200);
  const waterBlocked = await request('/api/neptuno/ingest', {
    method: 'POST', deviceKey, body: { soil_humidity: 10, temperature: 22, water_level: 10 },
  });
  if (waterBlocked.data.irrigation !== 'OFF') throw new Error('Low water level did not force OFF.');
  report('AUTO starts below minimum, holds through hysteresis, and stops for low water');

  const foreignManualControl = await request('/api/neptuno/irrigation/manual', {
    method: 'POST',
    token: users[0].token,
    body: { cropId: cropB.id, status: 'OFF' },
  });
  expectStatus(foreignManualControl, [400, 403, 404], 'Reject manual control of another user crop');
  const directManualLog = await request('/api/collections/irrigation_logs/records', {
    method: 'POST',
    token: users[0].token,
    body: { userId: users[0].id, cropId: cropA.id, status: 'OFF', source: 'MANUAL' },
  });
  expectStatus(directManualLog, [400, 403, 404], 'Reject direct manual log creation');
  report('manual control is owner-only and logs cannot bypass the server route');

  const manualLogResponse = await request('/api/neptuno/irrigation/manual', {
    method: 'POST',
    token: users[0].token,
    body: { cropId: cropA.id, status: 'OFF' },
  });
  expectStatus(manualLogResponse, [201], 'Create manual OFF log');
  let cropAfterManual;
  let overrideUntil = new Date(manualLogResponse.data.manual_override_until).getTime();
  const overrideDeadline = Date.now() + 5000;
  while (Date.now() < overrideDeadline) {
    cropAfterManual = await request(`/api/collections/crops/records/${cropA.id}`, { token: users[0].token });
    const persistedOverrideUntil = new Date(cropAfterManual.data.manual_override_until).getTime();
    if (Number.isFinite(persistedOverrideUntil) && persistedOverrideUntil > Date.now()) {
      overrideUntil = persistedOverrideUntil;
      break;
    }
    await sleep(100);
  }
  if (!Number.isFinite(overrideUntil) || overrideUntil <= Date.now()) {
    throw new Error(`Manual override expiry was not persisted (value: ${String(cropAfterManual.data?.manual_override_until || manualLogResponse.data?.manual_override_until || 'empty')}; crop mode: ${cropAfterManual.data?.control_mode}; log source: ${manualLogResponse.data?.log?.source}).`);
  }
  for (let count = 0; count < 3; count += 1) {
    await sleep(1200);
    const manualHold = await request('/api/neptuno/ingest', {
      method: 'POST', deviceKey, body: { soil_humidity: 10, temperature: 22, water_level: 80 },
    });
    if (manualHold.data.irrigation !== 'OFF') throw new Error(`Manual override was lost on reading ${count + 1}.`);
  }
  report('manual OFF remains in force for three low-humidity readings and has a persisted expiry');

  await sleep(1200);
  const jitterFirst = await request('/api/neptuno/ingest', {
    method: 'POST', deviceKey, body: { soil_humidity: 10, temperature: 22, water_level: 80 },
  });
  expectStatus(jitterFirst, [200], 'First jitter-tolerance reading');
  await sleep(1200);
  const jitterSecond = await request('/api/neptuno/ingest', {
    method: 'POST', deviceKey, body: { soil_humidity: 10, temperature: 22, water_level: 80 },
  });
  expectStatus(jitterSecond, [200], 'Reading after 0.6 interval');
  report('two readings separated by 0.6x interval are accepted');

  const readings = await request(`/api/collections/sensor_readings/records?filter=cropId%3D%22${cropA.id}%22`, { token: users[0].token });
  expectStatus(readings, [200], 'Read own sensor readings');
  const waterRecord = await request('/api/collections/water_consumption/records', {
    method: 'POST',
    token: adminToken,
    body: {
      userId: users[0].id,
      cropId: cropA.id,
      consumption_liters: 1,
      consumption_date: new Date().toISOString(),
      period: 'daily',
    },
  });
  expectStatus(waterRecord, [200, 201], 'Create protected water record fixture');
  for (const [collection, recordId, mutableField] of [
    ['sensor_readings', readings.data.items[0]?.id, { soil_humidity: 11 }],
    ['irrigation_logs', logsResponse.data.items[0]?.id, { status: 'OFF' }],
    ['water_consumption', waterRecord.data.id, { consumption_liters: 2 }],
  ]) {
    if (!recordId) throw new Error(`Missing ${collection} fixture.`);
    const update = await request(`/api/collections/${collection}/records/${recordId}`, {
      method: 'PATCH', token: users[0].token, body: mutableField,
    });
    const deletion = await request(`/api/collections/${collection}/records/${recordId}`, {
      method: 'DELETE', token: users[0].token,
    });
    expectStatus(update, [400, 403, 404], `${collection} update denial`);
    expectStatus(deletion, [400, 403, 404], `${collection} delete denial`);
  }
  report('users cannot PATCH or DELETE sensor readings, logs, or water consumption');

  const schedule = await request('/api/collections/irrigation_schedules/records', {
    method: 'POST',
    token: users[0].token,
    body: {
      userId: users[0].id,
      cropId: cropA.id,
      date: '2099-01-01',
      startTime: '08:00',
      endTime: '08:30',
      recurrence: 'ONCE',
    },
  });
  expectStatus(schedule, [200, 201], 'Create own schedule');
  const moveDevice = await request(`/api/collections/devices/records/${device.id}`, {
    method: 'PATCH', token: users[0].token, body: { cropId: cropB.id },
  });
  const moveSchedule = await request(`/api/collections/irrigation_schedules/records/${schedule.data.id}`, {
    method: 'PATCH', token: users[0].token, body: { cropId: cropB.id },
  });
  expectStatus(moveDevice, [400, 403, 404], 'Cross-owner device reassignment denial');
  expectStatus(moveSchedule, [400, 403, 404], 'Cross-owner schedule reassignment denial');
  const foreignCrop = await request(`/api/collections/crops/records/${cropA.id}`, { token: users[1].token });
  const foreignDevice = await request(`/api/collections/devices/records/${device.id}`, { token: users[1].token });
  const foreignReading = await request(`/api/collections/sensor_readings/records/${readings.data.items[0].id}`, { token: users[1].token });
  const foreignLog = await request(`/api/collections/irrigation_logs/records/${logsResponse.data.items[0].id}`, { token: users[1].token });
  const foreignSchedule = await request(`/api/collections/irrigation_schedules/records/${schedule.data.id}`, { token: users[1].token });
  const foreignWaterRecord = await request(`/api/collections/water_consumption/records/${waterRecord.data.id}`, { token: users[1].token });
  expectStatus(foreignCrop, [400, 403, 404], 'Foreign crop read denial');
  expectStatus(foreignDevice, [400, 403, 404], 'Foreign device read denial');
  expectStatus(foreignReading, [400, 403, 404], 'Foreign reading read denial');
  expectStatus(foreignLog, [400, 403, 404], 'Foreign irrigation log read denial');
  expectStatus(foreignSchedule, [400, 403, 404], 'Foreign schedule read denial');
  expectStatus(foreignWaterRecord, [400, 403, 404], 'Foreign water consumption read denial');
  report('users cannot move devices/schedules across crops or read another user data');

  // Regresiones de datos: toda colección base debe tener created/updated y las consultas
  // reales de la web (sort por created) deben responder 200.
  const collectionList = await request('/api/collections?perPage=200', { token: adminToken });
  expectStatus(collectionList, [200], 'List collections');
  const withoutTimestamps = collectionList.data.items
    .filter((collection) => collection.type === 'base' && !collection.system && !collection.name.startsWith('_'))
    .filter((collection) => !['created', 'updated'].every((name) => collection.fields.some((field) => field.name === name)))
    .map((collection) => collection.name);
  if (withoutTimestamps.length > 0) throw new Error(`Collections without created/updated: ${withoutTimestamps.join(', ')}`);
  for (const query of ['crops?sort=created', 'irrigation_schedules?sort=created', 'devices?sort=created', 'sensor_readings_hourly?sort=-created', 'user_settings?sort=-updated']) {
    const [name, qs] = query.split('?');
    expectStatus(await request(`/api/collections/${name}/records?${qs}`, { token: users[0].token }), [200], `Client query ${query}`);
  }
  report('every collection has created/updated and the web client queries return 200');

  // Un cultivo sin umbrales (PocketBase guarda 0) no debe generar alertas ni correos.
  const bareCrop = await request('/api/collections/crops/records', {
    method: 'POST', token: users[0].token, body: { userId: users[0].id, name: 'Smoke crop sin umbrales', control_mode: 'MANUAL' },
  });
  expectStatus(bareCrop, [200, 201], 'Create crop without thresholds');
  const bareDevice = await request('/api/neptuno/devices', {
    method: 'POST', token: users[0].token, body: { cropId: bareCrop.data.id, name: 'Smoke bare device', interval_seconds: 5 },
  });
  expectStatus(bareDevice, [201], 'Create device for the bare crop');
  expectStatus(await request('/api/neptuno/ingest', {
    method: 'POST', deviceKey: bareDevice.data.key, body: { soil_humidity: 50, temperature: 45, water_level: 2 },
  }), [200], 'Ingest for crop without thresholds');
  const bareQueue = await request(`/api/collections/notification_queue/records?filter=${encodeURIComponent(`cropId="${bareCrop.data.id}"`)}`, { token: adminToken });
  if (bareQueue.data.totalItems !== 0) throw new Error('A crop without thresholds queued an alert email.');
  report('a crop without thresholds produces no alert and no queued email');

  // Verificación de correo contra un proveedor simulado (solo si se indica MOCK_MAIL_URL).
  if (mockMailUrl) {
    const mock = async (path, body) => (await fetch(`${mockMailUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    })).json();
    const otpStatus = async (otpId) => {
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const status = await request(`/api/neptuno/auth/otp-status?otpId=${otpId}`);
        if (status.data.status !== 'pending') return status.data;
        await sleep(200);
      }
      return { status: 'pending' };
    };
    const otpEmail = `neptuno-smoke-otp-${id}@example.test`;
    const otpUser = await request('/api/collections/users/records', {
      method: 'POST', body: { email: otpEmail, password, passwordConfirm: password, name: 'E2E OTP' },
    });
    expectStatus(otpUser, [200, 201], 'Register unverified user');
    createdUserIds.push(otpUser.data.id);
    const unverifiedLogin = await request('/api/collections/users/auth-with-password', { method: 'POST', body: { identity: otpEmail, password } });
    expectStatus(unverifiedLogin, [403], 'Unverified login is rejected');
    await mock('/__reset', {});
    await mock('/__mode', { mode: 'ok' });
    const otpRequest = await request('/api/collections/users/request-otp', { method: 'POST', body: { email: otpEmail } });
    expectStatus(otpRequest, [200], 'Request OTP');
    const delivered = await otpStatus(otpRequest.data.otpId);
    if (delivered.status !== 'sent') throw new Error(`OTP delivery status was ${JSON.stringify(delivered)}`);
    const outbox = await mock('/__outbox');
    const code = JSON.stringify(outbox).match(/\b(\d{6})\b/)?.[1];
    if (!code) throw new Error('The OTP email did not contain a six-digit code.');
    const otpAuth = await request('/api/collections/users/auth-with-otp', { method: 'POST', body: { otpId: otpRequest.data.otpId, password: code } });
    expectStatus(otpAuth, [200], 'Authenticate with OTP');
    if (otpAuth.data.record.verified !== true) throw new Error('OTP authentication did not verify the user.');
    expectStatus(await request('/api/collections/users/auth-with-password', { method: 'POST', body: { identity: otpEmail, password } }), [200], 'Login after verification');
    report('register → request OTP → six-digit email → auth-with-otp → verified → password login');

    await mock('/__mode', { mode: '403' });
    const rejected = await request('/api/collections/users/request-otp', { method: 'POST', body: { email: otpEmail } });
    expectStatus(rejected, [200], 'Request OTP while the provider rejects');
    const rejectedStatus = await otpStatus(rejected.data.otpId);
    if (rejectedStatus.status !== 'failed' || rejectedStatus.reason !== 'provider_rejected') {
      throw new Error(`Expected failed/provider_rejected but got ${JSON.stringify(rejectedStatus)}`);
    }
    await mock('/__mode', { mode: 'ok' });
    report('a provider rejection is reported as failed/provider_rejected instead of silent success');
  }

  if (slowMode) {
    const forcedOn = await request(`/api/collections/devices/records/${device.id}`, {
      method: 'PATCH', token: adminToken, body: { desired_state: 'ON' },
    });
    expectStatus(forcedOn, [200], 'Set watchdog fixture state');
    const watchdogOn = await request('/api/collections/irrigation_logs/records', {
      method: 'POST',
      token: adminToken,
      body: { userId: users[0].id, cropId: cropA.id, status: 'ON', source: 'THRESHOLD', deviceId: device.id },
    });
    expectStatus(watchdogOn, [200, 201], 'Create watchdog fixture log');
    const deadline = Date.now() + 125_000;
    let stopped = false;
    while (Date.now() < deadline && !stopped) {
      await sleep(3000);
      const latest = await request(`/api/collections/irrigation_logs/records?filter=cropId%3D%22${cropA.id}%22&sort=-created&perPage=1`, { token: users[0].token });
      stopped = latest.data.items?.[0]?.source === 'WATCHDOG' && latest.data.items[0].status === 'OFF';
    }
    if (!stopped) throw new Error('Watchdog did not close the irrigation during the wait window.');
    report('watchdog closes irrigation after a silent device');
  }

  const simulatorCropResponse = await request('/api/collections/crops/records', {
    method: 'POST',
    token: users[0].token,
    body: {
      ...cropBody(users[0].id, 'Smoke simulator crop'),
      humidity_min: 30,
      humidity_max: 33,
    },
  });
  expectStatus(simulatorCropResponse, [200, 201], 'Create AUTO simulator crop');
  const simulatorDeviceResponse = await request('/api/neptuno/devices', {
    method: 'POST',
    token: users[0].token,
    body: { cropId: simulatorCropResponse.data.id, name: 'Smoke simulator device', interval_seconds: 1 },
  });
  expectStatus(simulatorDeviceResponse, [201], 'Create simulator device');
  const simulatorEnvironment = {
    DEVICE_KEY: simulatorDeviceResponse.data.key,
    PATH: process.env.PATH || '',
  };
  for (const variable of ['SYSTEMROOT', 'WINDIR']) {
    if (process.env[variable]) simulatorEnvironment[variable] = process.env[variable];
  }
  const simulator = spawn(process.execPath, [
    fileURLToPath(new URL('./simulate-device.js', import.meta.url)),
    '--url',
    baseUrl,
    '--interval',
    '1',
    '--humidity',
    '31',
  ], {
    env: simulatorEnvironment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let simulatorOutput = '';
  let simulatorError = '';
  simulator.stdout.setEncoding('utf8');
  simulator.stderr.setEncoding('utf8');
  simulator.stdout.on('data', (chunk) => { simulatorOutput += chunk; });
  simulator.stderr.on('data', (chunk) => { simulatorError += chunk; });
  const simulatorExit = new Promise((resolve) => simulator.once('exit', resolve));
  try {
    const deadline = Date.now() + 25_000;
    let cycled = false;
    while (Date.now() < deadline && simulator.exitCode === null) {
      const states = [...simulatorOutput.matchAll(/riego (ON|OFF)/g)].map((match) => match[1]);
      const firstOn = states.indexOf('ON');
      const offAfterOn = states.indexOf('OFF', firstOn + 1);
      cycled = firstOn >= 0 && offAfterOn >= 0 && states.indexOf('ON', offAfterOn + 1) >= 0;
      if (cycled) break;
      await sleep(250);
    }
    if (!cycled) throw new Error(`Simulator did not cycle AUTO ON → OFF → ON. ${simulatorError.trim()}`);
    report('real simulator cycles an AUTO crop from ON to OFF and back to ON');
  } finally {
    if (simulator.exitCode === null) {
      simulator.kill('SIGINT');
      await Promise.race([simulatorExit, sleep(2000)]);
      if (simulator.exitCode === null) simulator.kill();
    }
  }
} catch (error) {
  report('smoke test execution', error);
  process.exitCode = 1;
} finally {
  if (adminToken) {
    for (const userId of createdUserIds) {
      await request(`/api/collections/users/records/${userId}`, { method: 'DELETE', token: adminToken }).catch(() => {});
    }
  }
}
