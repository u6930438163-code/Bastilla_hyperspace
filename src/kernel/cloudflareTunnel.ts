import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface CloudflareTunnelConfig {
  token?: string;
  customDomain?: string;
  autoStart?: boolean;
}

export interface CloudflareTunnelStatus {
  running: boolean;
  pid?: number;
  mode: 'named-tunnel' | 'trycloudflare' | 'stopped';
  publicUrl: string | null;
  mcpStreamableUrl: string | null;
  mcpSseUrl: string | null;
  openApiUrl: string | null;
  fixedGoogleCloudUrl: string;
  hasNamedToken: boolean;
  customDomain?: string;
  startedAt?: string;
  lastLogLine?: string;
  error?: string;
}

export const PERMANENT_GOOGLE_CLOUD_URL = 'https://ais-pre-gam4th5sss3zxxhhjq7gap-873947482948.europe-west2.run.app';
const TUNNEL_CONFIG_FILE = path.resolve(process.cwd(), '.svl_tunnel_config.json');
const LOG_FILE = '/tmp/cloudflared.log';
const BIN_PATH = path.resolve(process.cwd(), 'bin', 'cloudflared');

let tunnelProcess: ChildProcess | null = null;
let currentPublicUrl: string | null = null;
let tunnelMode: 'named-tunnel' | 'trycloudflare' | 'stopped' = 'stopped';
let startedAt: string | undefined;
let lastError: string | undefined;
let isStopping = false;

export function loadTunnelConfig(): CloudflareTunnelConfig {
  const envToken = (process.env.CLOUDFLARE_TUNNEL_TOKEN || '').trim();
  const envDomain = (process.env.CLOUDFLARE_TUNNEL_HOSTNAME || process.env.CLOUDFLARE_DOMAIN || '').trim();

  let fileConfig: CloudflareTunnelConfig = {};
  try {
    if (fs.existsSync(TUNNEL_CONFIG_FILE)) {
      const raw = fs.readFileSync(TUNNEL_CONFIG_FILE, 'utf-8');
      fileConfig = JSON.parse(raw);
    }
  } catch {}

  return {
    token: envToken || fileConfig.token || undefined,
    customDomain: envDomain || fileConfig.customDomain || undefined,
    autoStart: fileConfig.autoStart ?? true,
  };
}

export function saveTunnelConfig(config: CloudflareTunnelConfig): void {
  try {
    fs.writeFileSync(TUNNEL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[CLOUDFLARE] Nie udało się zapisać .svl_tunnel_config.json:', err);
  }
}

export function getTunnelBinaryPath(): string | null {
  if (fs.existsSync(BIN_PATH)) return BIN_PATH;
  return null;
}

function parseUrlFromLog(): string | null {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const matches = Array.from(content.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi));
      if (matches.length > 0) {
        return matches[matches.length - 1][0];
      }
    }
  } catch {}
  return null;
}

export function getCloudflareTunnelStatus(): CloudflareTunnelStatus {
  const config = loadTunnelConfig();
  const isRunning = Boolean(tunnelProcess && !tunnelProcess.killed && tunnelProcess.pid);
  const activeUrl = currentPublicUrl || parseUrlFromLog();

  const publicUrl = config.customDomain
    ? (config.customDomain.startsWith('http') ? config.customDomain : `https://${config.customDomain}`)
    : activeUrl;

  return {
    running: isRunning,
    pid: tunnelProcess?.pid,
    mode: isRunning ? tunnelMode : 'stopped',
    publicUrl,
    mcpStreamableUrl: publicUrl ? `${publicUrl.replace(/\/+$/, '')}/mcp` : null,
    mcpSseUrl: publicUrl ? `${publicUrl.replace(/\/+$/, '')}/sse` : null,
    openApiUrl: publicUrl ? `${publicUrl.replace(/\/+$/, '')}/openapi.json` : null,
    fixedGoogleCloudUrl: PERMANENT_GOOGLE_CLOUD_URL,
    hasNamedToken: Boolean(config.token && config.token.length > 20),
    customDomain: config.customDomain,
    startedAt,
    error: lastError,
  };
}

export async function stopCloudflareTunnel(): Promise<void> {
  isStopping = true;
  if (tunnelProcess) {
    try {
      tunnelProcess.kill('SIGTERM');
    } catch {}
    tunnelProcess = null;
  }
  currentPublicUrl = null;
  tunnelMode = 'stopped';
  isStopping = false;
}

export async function startCloudflareTunnel(targetPort: number = 3000): Promise<CloudflareTunnelStatus> {
  const binary = getTunnelBinaryPath();
  if (!binary) {
    lastError = 'Brak pliku binarnego cloudflared w katalogu ./bin/cloudflared';
    console.warn(`[CLOUDFLARE] ${lastError}`);
    return getCloudflareTunnelStatus();
  }

  // Jeśli tunel już działa i odpowiada, zwróć bieżący status
  if (tunnelProcess && !tunnelProcess.killed && currentPublicUrl) {
    return getCloudflareTunnelStatus();
  }

  await stopCloudflareTunnel();

  const config = loadTunnelConfig();
  const args: string[] = [];

  if (config.token && config.token.length > 20) {
    // Stały tunel nazwany (Named Tunnel) — łączy się z domeną skonfigurowaną w Cloudflare Zero Trust
    tunnelMode = 'named-tunnel';
    args.push('tunnel', 'run', '--token', config.token, '--protocol', 'http2');
    console.log('[CLOUDFLARE] Uruchamianie stałego tunelu z tokenem Named Tunnel...');
    if (config.customDomain) {
      currentPublicUrl = config.customDomain.startsWith('http') ? config.customDomain : `https://${config.customDomain}`;
    }
  } else {
    // Szybki tunel TryCloudflare z wymuszonym protokołem HTTP/2
    tunnelMode = 'trycloudflare';
    try {
      fs.writeFileSync(LOG_FILE, '', 'utf-8');
    } catch {}
    args.push('tunnel', '--protocol', 'http2', '--url', `http://127.0.0.1:${targetPort}`, '--logfile', LOG_FILE);
    console.log(`[CLOUDFLARE] Uruchamianie tunelu HTTP/2 do portu ${targetPort}...`);
  }

  try {
    const child = spawn(binary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });
    tunnelProcess = child;
    startedAt = new Date().toISOString();
    lastError = undefined;

    const handleOutput = (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) {
        currentPublicUrl = match[0];
        console.log(`[CLOUDFLARE] Zarejestrowano URL tunelu: ${currentPublicUrl}`);
      }
    };

    child.stdout?.on('data', handleOutput);
    child.stderr?.on('data', handleOutput);

    child.on('error', (err) => {
      lastError = err.message;
      console.error('[CLOUDFLARE] Błąd procesu tunelu:', err);
    });

    child.on('exit', (code, signal) => {
      console.warn(`[CLOUDFLARE] Proces tunelu zakończył się (code: ${code}, signal: ${signal})`);
      if (tunnelProcess === child) {
        tunnelProcess = null;
        tunnelMode = 'stopped';
      }
      if (!isStopping && config.autoStart) {
        console.log('[CLOUDFLARE] Automatyczne wznawianie tunelu za 5 sekund...');
        setTimeout(() => {
          void startCloudflareTunnel(targetPort);
        }, 5000);
      }
    });

    // Poczekaj chwilę na zalogowanie URL
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 400));
      if (!currentPublicUrl) {
        currentPublicUrl = parseUrlFromLog();
      }
      if (currentPublicUrl) break;
    }

    return getCloudflareTunnelStatus();
  } catch (err: any) {
    lastError = err?.message || String(err);
    console.error('[CLOUDFLARE] Błąd podczas uruchamiania tunelu:', err);
    return getCloudflareTunnelStatus();
  }
}
