import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appDir = __dirname;
const rootDir = path.resolve(appDir, '..', '..');
const envPath = path.join(rootDir, '.env');

const envFromFile = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    envFromFile[key] = value.replace(/^['"]|['"]$/g, '');
  }
}

const binaryName = process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase';
const candidates = [
  path.join(appDir, binaryName),
  path.join(rootDir, 'apps', 'pocketbase', binaryName),
];

const binaryPath = candidates.find((candidate) => fs.existsSync(candidate));

if (!binaryPath) {
  console.error(`PocketBase binary not found. Looked in: ${candidates.join(', ')}`);
  process.exit(1);
}

const env = { ...envFromFile, ...process.env };
const encryptionKey = env.PB_ENCRYPTION_KEY;

if (!encryptionKey || encryptionKey.length !== 32) {
  console.error('PB_ENCRYPTION_KEY is required and must contain exactly 32 characters.');
  process.exit(1);
}

if (env.BUILDER_MAILER_SENDER_ADDRESS?.toLowerCase().endsWith('@resend.dev')) {
  console.warn('El remitente de prueba de Resend solo entrega a destinatarios autorizados. Verifica tu propio dominio y usa una dirección de ese dominio para enviar códigos a otros usuarios.');
}

const ensureDemoUser = async () => {
  const demoEmail = env.DEMO_EMAIL;
  const demoPassword = env.DEMO_PASSWORD;
  const demoName = env.DEMO_NAME || 'Demo Neptuno';

  if (!demoEmail || !demoPassword) {
    console.error('Demo user setup requires both DEMO_EMAIL and DEMO_PASSWORD.');
    return;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const listResponse = await fetch('http://127.0.0.1:8090/api/collections/users/records?perPage=1');
      if (listResponse.ok) {
        const listData = await listResponse.json();
        if ((listData.totalItems ?? 0) > 0) {
          return;
        }
      }

      const createResponse = await fetch('http://127.0.0.1:8090/api/collections/users/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: demoEmail,
          password: demoPassword,
          passwordConfirm: demoPassword,
          name: demoName,
          emailVisibility: true,
        }),
      });

      if (createResponse.ok) {
        console.log(`Demo user ready: ${demoEmail}`);
        return;
      }

      const rawText = await createResponse.text();
      const lowerText = (rawText || '').toLowerCase();
      const duplicateUser = lowerText.includes('validation_not_unique')
        || lowerText.includes('already')
        || lowerText.includes('value must be unique');

      if (duplicateUser) {
        console.log(`Demo user already exists: ${demoEmail}`);
        return;
      }

      if (rawText) {
        console.warn('Demo user creation response:', rawText);
      }
    } catch (error) {
      // PocketBase server may still be starting up.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

const child = spawn(
  binaryPath,
  [
    'serve',
    '--http=0.0.0.0:8090',
    '--encryptionEnv=PB_ENCRYPTION_KEY',
    '--dir=./pb_data',
    '--migrationsDir=./pb_migrations',
    '--hooksDir=./pb_hooks',
    '--hooksWatch=false',
  ],
  {
    cwd: appDir,
    stdio: 'inherit',
    env,
  }
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('Failed to start PocketBase:', error.message);
  process.exit(1);
});

setTimeout(() => {
  if (env.NODE_ENV !== 'production' && env.ENABLE_DEMO_USER === 'true') {
    ensureDemoUser();
  }
}, 2000);
