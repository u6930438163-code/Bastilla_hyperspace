import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const token = process.argv[2] || process.env.SVL_LINUX_SYNC_TOKEN;
const appPort = Number(process.env.PORT || 3000);
const targetBase = (process.env.SVL_BACKEND_URL || `http://127.0.0.1:${appPort}`).replace(/\/$/, '');
const ollamaBase = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');

if (!token || token.length < 32) {
  console.error('Usage: node scripts/linux-observer.mjs <SVL_LINUX_SYNC_TOKEN (min 32 chars)>');
  process.exit(1);
}

const ingestUrl = `${targetBase}/api/linux/ingest`;
const scope = process.env.SVL_HOST_SCOPE === 'linux-host' ? 'linux-host' : 'app-container';

console.log(`[LINUX OBSERVER] Started PID=${process.pid}, scope=${scope}, target=${ingestUrl}`);

function getMemoryPercent() {
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    let total = 0;
    let available = 0;
    for (const line of meminfo.split('\n')) {
      if (line.startsWith('MemTotal:')) total = parseInt(line.split(/\s+/)[1], 10);
      if (line.startsWith('MemAvailable:')) available = parseInt(line.split(/\s+/)[1], 10);
    }
    if (total > 0 && available > 0) {
      return Math.round((1 - available / total) * 1000) / 10;
    }
  } catch {}
  const total = os.totalmem();
  const free = os.freemem();
  return total > 0 ? Math.round((1 - free / total) * 1000) / 10 : 0;
}

function getDiskPercent() {
  try {
    const out = spawnSync('df', ['-P', '/'], { encoding: 'utf8', timeout: 3000 });
    if (out.status === 0 && out.stdout) {
      const lines = out.stdout.trim().split('\n');
      const last = lines[lines.length - 1] || '';
      const match = last.match(/(\d+)%/);
      if (match) return Number(match[1]);
    }
  } catch {}
  return 0;
}

function getProcessCount() {
  try {
    const entries = fs.readdirSync('/proc');
    return entries.filter((name) => /^\d+$/.test(name)).length;
  } catch {
    return 1;
  }
}

function getRealServices() {
  try {
    if (fs.existsSync('/run/systemd/system')) {
      const out = spawnSync(
        'systemctl',
        ['list-units', '--type=service', '--no-pager', '--no-legend', '--plain'],
        { encoding: 'utf8', timeout: 4000 },
      );
      if (out.status === 0 && out.stdout) {
        return out.stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 120)
          .map((line) => {
            const parts = line.split(/\s+/);
            return {
              name: parts[0] || 'unknown.service',
              state: `${parts[2] || 'unknown'}/${parts[3] || 'unknown'}`,
            };
          });
      }
    }
  } catch {}
  return [];
}

async function probeLocalOllama() {
  try {
    const res = await fetch(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { reachable: false, models: [] };
    const data = await res.json();
    const models = Array.isArray(data?.models)
      ? data.models.map((m) => m?.name).filter((n) => typeof n === 'string')
      : [];
    return { reachable: true, models };
  } catch {
    return { reachable: false, models: [] };
  }
}

async function sendSample() {
  try {
    const ollama = await probeLocalOllama();
    const sample = {
      scope,
      hostname: os.hostname(),
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      kernel: os.release(),
      uid: typeof process.geteuid === 'function' ? process.geteuid() : 1000,
      observedAt: new Date().toISOString(),
      memoryPercent: getMemoryPercent(),
      diskPercent: getDiskPercent(),
      processCount: getProcessCount(),
      services: getRealServices(),
      ollama,
    };

    const res = await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(sample),
    });

    if (!res.ok) {
      console.warn(`[LINUX OBSERVER] Ingest HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[LINUX OBSERVER] Ingest error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

void sendSample();
setInterval(() => void sendSample(), 10000);
