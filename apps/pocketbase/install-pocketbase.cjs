const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const baseDir = __dirname;
const versionFile = path.join(baseDir, '.pocketbase-version');
const version = fs.existsSync(versionFile)
  ? fs.readFileSync(versionFile, 'utf8').trim()
  : '0.36.1';

const platformMap = {
  win32: 'windows',
  linux: 'linux',
  darwin: 'darwin',
};
const archMap = {
  x64: 'amd64',
  arm64: 'arm64',
};

const osName = platformMap[process.platform] || process.platform;
const archName = archMap[process.arch] || process.arch;
const binaryName = process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase';
const binaryPath = path.join(baseDir, binaryName);

if (fs.existsSync(binaryPath)) {
  console.log(`PocketBase already available at ${binaryPath}`);
  process.exit(0);
}

const zipName = `pocketbase_${version}_${osName}_${archName}.zip`;
const zipUrl = `https://github.com/pocketbase/pocketbase/releases/download/v${version}/${zipName}`;
const zipPath = path.join(baseDir, 'pocketbase.zip');

async function downloadFile(url, destination) {
  const response = await fetch(url, { headers: { 'User-Agent': 'neptuno-local-dev' } });
  if (!response.ok) {
    throw new Error(`Failed to download PocketBase: ${response.status} ${response.statusText} (${url})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, buffer);
}

(async () => {
  try {
    console.log(`Downloading PocketBase ${version} for ${osName}/${archName}...`);
    await downloadFile(zipUrl, zipPath);

    if (process.platform === 'win32') {
      const result = spawnSync(
        'powershell',
        ['-NoProfile', '-Command', `Expand-Archive -Force -Path "${zipPath}" -DestinationPath "${baseDir}"`],
        { stdio: 'inherit' }
      );
      if (result.status !== 0) process.exit(result.status ?? 1);
    } else {
      const result = spawnSync('unzip', ['-o', zipPath, '-d', baseDir], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status ?? 1);
    }

    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    if (process.platform !== 'win32' && fs.existsSync(binaryPath)) fs.chmodSync(binaryPath, 0o755);

    console.log(`PocketBase installed at ${binaryPath}`);
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
})();
