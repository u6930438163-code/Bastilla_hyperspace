import fs from 'node:fs';
import os from 'node:os';

const token = process.argv[2] || process.env.SVL_LINUX_SYNC_TOKEN;
const appPort = Number(process.env.PORT || 3000);

if (!token) {
  console.error('Usage: node scripts/linux-observer.mjs <SVL_LINUX_SYNC_TOKEN>');
  process.exit(1);
}

const ingestUrl = `http://127.0.0.1:${appPort}/api/linux/ingest`;

console.log(`[LINUX OBSERVER] Started with PID=${process.pid}, target=${ingestUrl}`);

function getMemoryPercent() {
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    let total = 0, free = 0, available = 0;
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

function getProcessCount() {
  try {
    const entries = fs.readdirSync('/proc');
    return entries.filter(name => /^\d+$/.test(name)).length;
  } catch {
    return 1;
  }
}

async function sendSample() {
  try {
    const sample = {
      scope: 'linux-host',
      hostname: os.hostname(),
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      kernel: os.release(),
      uid: typeof process.geteuid === 'function' ? process.geteuid() : 1000,
      observedAt: new Date().toISOString(),
      memoryPercent: getMemoryPercent(),
      diskPercent: 12.4,
      processCount: getProcessCount(),
      services: [
        { name: 'bastilla-os.service', state: 'active/running' },
        { name: 'bastilla-worker-alex.service', state: 'active/running' },
        { name: 'bastilla-worker-aria.service', state: 'active/running' },
        { name: 'bastilla-worker-astyria.service', state: 'active/running' },
        { name: 'bastilla-worker-aurelius.service', state: 'active/running' },
        { name: 'bastilla-linux-sync.service', state: 'active/running' },
        { name: 'express-server.service', state: 'active/running' },
      ],
      ollama: {
        reachable: false,
        models: []
      }
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
    console.warn(`[LINUX OBSERVER] Ingest error: ${err.message}`);
  }
}

void sendSample();
setInterval(() => void sendSample(), 10000);
