const { spawnSync } = require('node:child_process');

const requestedPorts = process.argv.slice(2);
const ports = (requestedPorts.length ? requestedPorts : ['3000', '8090']).map(Number).filter((port) => Number.isInteger(port) && port > 0 && port < 65536);

if (!ports.length) {
  process.exit(0);
}

function killPid(pid) {
  if (!pid) return;
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid)) return;

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(numericPid), '/F'], { stdio: 'inherit' });
  } else {
    try {
      process.kill(numericPid, 'SIGKILL');
    } catch (_) {
      // No-op: the process is already gone.
    }
  }
}

function killListeningPortsOnWindows() {
  const result = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
  if (result.error || !result.stdout) {
    return;
  }

  const pids = new Set();
  const lines = result.stdout.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/\s*(?:0\.0\.0\.0|\[::\]|\*|127\.0\.0\.1):([0-9]+)\s+\S+\s+LISTENING\s+(\d+)/i);
    if (!match) continue;
    const port = Number(match[1]);
    if (ports.includes(port)) {
      pids.add(match[2]);
    }
  }

  for (const pid of pids) {
    killPid(pid);
  }
}

function killListeningPortsOnUnix() {
  const pids = new Set();
  for (const port of ports) {
    const lsof = spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' });
    if (!lsof.error && lsof.stdout) {
      for (const line of lsof.stdout.split(/\r?\n/)) {
        if (line.trim()) pids.add(line.trim());
      }
    }
  }

  for (const pid of pids) {
    killPid(pid);
  }
}

if (process.platform === 'win32') {
  killListeningPortsOnWindows();
} else {
  killListeningPortsOnUnix();
}

console.log(`Cleaned up stale processes on ports: ${ports.join(', ')}`);
