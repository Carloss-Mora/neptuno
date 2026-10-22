import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(appDir, '..', '..');
const envPath = path.join(rootDir, '.env');
const envFromFile = {};

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const separatorIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    envFromFile[key] = value.replace(/^['"]|['"]$/g, '');
  }
}

const env = { ...envFromFile, ...process.env };
if (!env.PB_ENCRYPTION_KEY || env.PB_ENCRYPTION_KEY.length !== 32) {
  console.error('PB_ENCRYPTION_KEY is required and must contain exactly 32 characters.');
  process.exit(1);
}

const binaryName = process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase';
const binaryPath = [
  path.join(appDir, binaryName),
  path.join(rootDir, 'apps', 'pocketbase', binaryName),
].find((candidate) => fs.existsSync(candidate));

if (!binaryPath) {
  console.error('PocketBase binary not found. Run the install-pocketbase script first.');
  process.exit(1);
}

const commandArgs = process.argv.slice(2);
if (commandArgs.length === 0) {
  console.error('A PocketBase command is required.');
  process.exit(1);
}

if (commandArgs[0] === 'migrate' && commandArgs[1] === 'collections') {
  fs.mkdirSync(path.join(appDir, 'pb_snapshots'), { recursive: true });
}

const requiredOptions = [
  ['--encryptionEnv=', '--encryptionEnv=PB_ENCRYPTION_KEY'],
  ['--dir=', '--dir=./pb_data'],
  ['--migrationsDir=', '--migrationsDir=./pb_migrations'],
  ['--hooksDir=', '--hooksDir=./pb_hooks'],
  ['--hooksWatch=', '--hooksWatch=false'],
];

for (const [prefix, defaultOption] of requiredOptions) {
  if (!commandArgs.some((argument) => argument.startsWith(prefix))) {
    commandArgs.push(defaultOption);
  }
}

const child = spawn(binaryPath, commandArgs, {
  cwd: appDir,
  stdio: 'inherit',
  env,
});

child.on('error', (error) => {
  console.error('Failed to run PocketBase command:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
