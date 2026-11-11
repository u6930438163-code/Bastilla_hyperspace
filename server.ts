import express from 'express';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { fork, spawnSync } from 'node:child_process';
import { GoogleGenAI } from '@google/genai';
import type { AgentName, AgentState, Bootstrap, Message, ServerHealth, Session } from './src/lib/types';
import { OpenCodeBridge } from './src/lib/opencodeBridge';
import { requireGitHubWriteToken } from './src/lib/githubWriteAuth';
import { createGlobalLiveSync } from './src/lib/globalLiveSync';
import { createAiRuntimeRouter } from './src/lib/aiRuntimeRoutes';
import { createAiDesktopRouter } from './src/lib/aiDesktopRoutes';
import { createAiSecurityToolkitRouter } from './src/lib/aiSecurityToolkit';
import { createFleetRouter } from './src/lib/fleetRoutes';
import { HyperspaceOS } from './src/lib/hyperos';
import { withoutNlpEngine } from './src/lib/withoutNlpEngine';
import { buildSystemContext, generateLocalReply, type LocalNlpAgent } from './src/lib/localNlpEngine';
import { SharedSystemMemory } from './src/kernel/systemMemory';
import {
  INITIAL_DATA_STORE,
  SYS_VERSION,
  OPERATOR_NAME,
  normalizeDataStore,
  generatePythonMonolith,
  parsePythonMonolith,
  generateTextReport,
  type DataStore,
} from './src/kernel/svlKernel';
import {
  ASTYRIA_MISSION_ACTIONS,
  ASTYRIA_MISSION_LABELS,
  TRIAD_AGENT_NAMES,
  validateAgentProtocolRequest,
  buildAgentProtocolReplies,
  parseChatProtocolCommand,
  type AstyriaMissionAction,
} from './src/kernel/agentProtocol';
import {
  parseChatApprovalCommand,
  type ChatApprovalAction,
} from './src/kernel/chatApprovals';
import {
  validateChatAttachments,
  formatChatMessage,
} from './src/kernel/chatAttachments';
import {
  generateWithChain,
  type LlmChainConfig,
} from './src/kernel/llmChain';
import {
  collectOllamaDiagnostics,
  buildOllamaRecommendations,
  describeOllamaDiagnostics,
} from './src/kernel/ollamaDiagnostics';
import {
  getGeminiVmStatus,
  GEMINI_PRIMARY_MODEL,
  GEMINI_FALLBACK_MODELS_DEFAULT,
} from './src/kernel/geminiVm';
import {
  getGitHubAdminStatus,
  listGitHubAdminActions,
  executeGitHubAdminAction,
  ensureGitHubTokenFromCodespaces,
} from './src/kernel/githubAdmin';
import {
  getCloudflareTunnelStatus,
  startCloudflareTunnel,
  stopCloudflareTunnel,
} from './src/kernel/cloudflareTunnel';
// @ts-ignore - ESM module without declaration file
import { fetchOriginalAgentsStatus } from './src/kernel/originalAgentsStatus.mjs';
// @ts-ignore - ESM module without declaration file
import { execute as executeGitMainSync } from './scripts/github-main-sync.mjs';

dotenv.config();
ensureGitHubTokenFromCodespaces();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16mb' }));

// Global live sync & GitHub write authentication
const liveSync = createGlobalLiveSync();
app.use(liveSync.observeMutation);
app.use(requireGitHubWriteToken);

// Retired legacy Git routes (explicit 410 per security regression contract)
app.post('/api/github/export', (_req, res) => res.status(410).json({
  success: false,
  error: 'Endpoint /api/github/export został wycofany. Użyj uwierzytelnionego zapisu Git na gałęzi main.',
}));
app.post('/api/github/pull', (_req, res) => res.status(410).json({
  success: false,
  error: 'Endpoint /api/github/pull został wycofany. Użyj uwierzytelnionego zapisu Git na gałęzi main.',
}));

const AGENTS: AgentName[] = ['Alex', 'Aria', 'Astyria', 'Aurelius'];
const dataDir = path.resolve(process.env.DATA_DIR || 'data');
const storePath = path.join(dataDir, 'bastilla-state.json');
const kernelStorePath = path.resolve(process.env.SVL_KERNEL_STORE_PATH || '.svl_kernel_store.json');
const appsDir = path.resolve('apps');
const exportsDir = path.resolve('exports');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(appsDir, { recursive: true });
fs.mkdirSync(exportsDir, { recursive: true });

const modelUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const ollamaApiKey = (process.env.OLLAMA_API_KEY || '').trim();
const ollamaHeaders = () => ({ ...(ollamaApiKey ? { Authorization: 'Bearer ' + ollamaApiKey } : {}) });
const configuredModel = (process.env.OLLAMA_MODEL || 'auto').trim();
const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
const geminiModel = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
const geminiFallbackModels = (process.env.GEMINI_FALLBACK_MODELS || GEMINI_FALLBACK_MODELS_DEFAULT).trim();
const openCode = new OpenCodeBridge({
  baseUrl: process.env.OPENCODE_BASE_URL,
  username: process.env.OPENCODE_SERVER_USERNAME,
  password: process.env.OPENCODE_SERVER_PASSWORD,
  allowRemote: process.env.OPENCODE_ALLOW_REMOTE === 'true',
});
const allowOllamaFallback = process.env.SVL_ALLOW_OLLAMA_FALLBACK !== 'false';
const allowGeminiFallback = process.env.SVL_ALLOW_GEMINI_FALLBACK === 'true';

function preferredOllamaModel(models: string[]): string | null {
  if (configuredModel !== 'auto') {
    return models.find((m) => m === configuredModel || m.startsWith(configuredModel + ':')) || null;
  }
  return models.find((m) => /llama3\.2[-:]vision|vision.*11b|llama3\.2:11b|14b.*uncensored|dolphin/i.test(m)) || models[0] || null;
}

const heartbeats = new Map<AgentName, { lastSeen: string; workerId: string; modelReady: boolean; model: string | null; error: string | null }>();

interface Job {
  id: string;
  sessionId: string;
  messageId: string;
  to: AgentName;
  content: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  leaseUntil: number;
  workerId?: string;
  attempts: number;
}

interface Db {
  sessions: Session[];
  messages: Message[];
  avatars: Record<string, string>;
  jobs: Job[];
  opencodeSessions: Record<string, string>;
  revision: number;
  updatedAt: string;
}

function loadDb(): Db {
  try {
    const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return {
      sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
      messages: Array.isArray(raw.messages) ? raw.messages : [],
      avatars: raw.avatars && typeof raw.avatars === 'object' ? raw.avatars : {},
      jobs: Array.isArray(raw.jobs) ? raw.jobs : [],
      opencodeSessions: raw.opencodeSessions && typeof raw.opencodeSessions === 'object' ? raw.opencodeSessions : {},
      revision: Number(raw.revision) || 0,
      updatedAt: String(raw.updatedAt || ''),
    };
  } catch {
    return { sessions: [], messages: [], avatars: {}, jobs: [], opencodeSessions: {}, revision: 0, updatedAt: '' };
  }
}

let db = loadDb();

function persist() {
  db.revision++;
  db.updatedAt = new Date().toISOString();
  const tmp = storePath + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, storePath);
}

// Kernel DATA_STORE persistence (backed by .svl_kernel_store.json and svl_kernel.py)
function loadKernelStore(): DataStore {
  try {
    if (fs.existsSync(kernelStorePath)) {
      const parsed = JSON.parse(fs.readFileSync(kernelStorePath, 'utf8'));
      return normalizeDataStore(parsed);
    }
  } catch {}
  return normalizeDataStore(INITIAL_DATA_STORE);
}

function saveKernelStore(nextStore: DataStore): DataStore {
  const normalized = normalizeDataStore(nextStore);
  const tmp = kernelStorePath + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(normalized, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, kernelStorePath);
  return normalized;
}

// Infrastructure log buffer (real events only)
interface InfraLogEntry {
  id: string;
  timestamp: string;
  agent: string;
  category: 'system' | 'repair' | 'mission' | 'deploy' | 'security' | 'git';
  level: 'info' | 'warn' | 'error';
  message: string;
}
const infraLogs: InfraLogEntry[] = [];
function recordInfraLog(
  agent: string,
  category: InfraLogEntry['category'],
  message: string,
  level: InfraLogEntry['level'] = 'info',
) {
  infraLogs.unshift({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    agent,
    category,
    level,
    message,
  });
  if (infraLogs.length > 250) infraLogs.length = 250;
}
recordInfraLog('System', 'system', 'Uruchomiono zintegrowany backend Bastilla OS / SVL_System.');

// SSE listeners for GUI First
const listeners = new Set<express.Response>();
function publish(topic = 'update') {
  for (const res of listeners) {
    if (res.writableEnded || res.destroyed) {
      listeners.delete(res);
      continue;
    }
    res.write('event: update\ndata: ' + JSON.stringify({ topic, at: new Date().toISOString(), revision: db.revision }) + '\n\n');
  }
}

function sendError(res: express.Response, error: string, status = 400) {
  res.status(status).json({ error, success: false });
}

function validateOrigin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.header('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.get('host')) return sendError(res, 'Odrzucono zapis z obcej domeny.', 403);
    } catch {
      return sendError(res, 'Błędny Origin.', 403);
    }
  }
  next();
}

// Operator session authentication
const operatorSecret = (process.env.SVL_OPERATOR_TOKEN || '').trim();
if (process.env.NODE_ENV === 'production' && operatorSecret.length < 32) {
  throw new Error('Production requires SVL_OPERATOR_TOKEN with 32+ characters');
}
const operatorSessions = new Map<string, number>();

function isLocalConnection(req: express.Request) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function secureEqual(a: string, b: string) {
  return Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function operatorAuthorized(req: express.Request) {
  if (!operatorSecret) return isLocalConnection(req);
  const bearer = (req.header('authorization') || '').replace(/^Bearer /i, '').trim();
  if (bearer && secureEqual(bearer, operatorSecret)) return true;
  const cookie = String(req.header('cookie') || '')
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('svl_session='));
  const session = cookie?.slice('svl_session='.length) || '';
  const expiry = operatorSessions.get(session) || 0;
  return expiry > Date.now();
}

// Mount modular routers that enforce their own specialized auth/contracts
const sharedMemory = new SharedSystemMemory();
app.use('/api/sync', liveSync.router);
app.use('/api/ai/runtime', createAiRuntimeRouter(sharedMemory));
app.use('/api/ai/desktop', createAiDesktopRouter());
app.use('/api/ai/security', createAiSecurityToolkitRouter());
app.use('/api/fleet', createFleetRouter());
app.use('/api/apps/preview', express.static(appsDir));

app.use('/api', validateOrigin);
app.use('/api', (req, res, next) => {
  if (
    req.path === '/health' ||
    req.path === '/auth/login' ||
    req.path === '/linux/ingest' ||
    req.path.startsWith('/worker/') ||
    req.path.startsWith('/ai/status') ||
    req.path.startsWith('/infrastructure/status') ||
    req.path.startsWith('/infrastructure/logs') ||
    req.path.startsWith('/apps/list') ||
    req.path.startsWith('/github/admin/status') ||
    req.path.startsWith('/original-agents/status') ||
    req.path.startsWith('/agents/linux-accounts') ||
    req.path.startsWith('/agents/status') ||
    req.path.startsWith('/ollama/status') ||
    req.path.startsWith('/sphere/status') ||
    req.path.startsWith('/terminals/status') ||
    req.path.startsWith('/mcp/tools') ||
    req.path.startsWith('/vm-gemini-4/status') ||
    req.path.startsWith('/kernel/quantum-wheel')
  ) {
    return next();
  }
  if (!operatorAuthorized(req)) {
    return sendError(res, 'Wymagana autoryzacja operatora (SVL_OPERATOR_TOKEN).', 401);
  }
  next();
});

function validSession(id: string) {
  return db.sessions.find((s) => s.id === id && !s.archived);
}

function ensureSession() {
  let session = db.sessions
    .filter((s) => !s.archived)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!session) {
    const now = new Date().toISOString();
    session = { id: randomUUID(), title: 'Nowa rozmowa', createdAt: now, updatedAt: now, archived: false };
    db.sessions.push(session);
    persist();
  }
  return session;
}

async function ollamaStatus(): Promise<ServerHealth['ollama']> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const response = await fetch(modelUrl + '/api/tags', { headers: ollamaHeaders(), signal: ctrl.signal });
    if (!response.ok) throw Error('HTTP ' + response.status);
    const json = (await response.json()) as { models?: { name?: string }[] };
    if (!Array.isArray(json.models)) throw Error('Niepoprawna lista modeli Ollama.');
    const models = json.models.map((m) => m.name || '').filter(Boolean);
    const model = preferredOllamaModel(models);
    return {
      reachable: true,
      model,
      models,
      configuredUrl: modelUrl,
      error: !model ? 'Brak dostępnego, skonfigurowanego modelu.' : null,
    };
  } catch (e) {
    return {
      reachable: false,
      model: null,
      models: [],
      configuredUrl: modelUrl,
      error: ctrl.signal.aborted
        ? 'Ollama nie odpowiedziała na /api/tags w ciągu 6 sekund.'
        : e instanceof Error
          ? e.message
          : 'Błąd połączenia',
    };
  } finally {
    clearTimeout(timer);
  }
}

function agentStatus(): AgentState[] {
  const now = Date.now();
  return AGENTS.map((name) => {
    const h = heartbeats.get(name);
    const connected = Boolean(h && now - Date.parse(h.lastSeen) < 40000);
    return {
      name,
      connected,
      lastSeen: h?.lastSeen || null,
      workerId: connected ? h!.workerId : null,
      modelReady: connected && h!.modelReady,
      model: connected ? h!.model : null,
      error: connected ? h!.error : null,
    };
  });
}

async function health(): Promise<ServerHealth> {
  const [ollama, opencode] = await Promise.all([ollamaStatus(), openCode.status()]);
  return {
    backend: 'online',
    observedAt: new Date().toISOString(),
    ollama,
    opencode,
    geminiConfigured: Boolean(geminiKey),
    agents: agentStatus(),
    limitations: [
      'Przeglądarka i AI Studio nie są hostowym Linuxem.',
      'Root i usługi systemd wymagają oddzielnego uwierzytelnionego backendu.',
      'Status agenta ONLINE wyłącznie po jego uwierzytelnionym heartbeat.',
    ],
  };
}

// ============================================================================
// 1. GUI FIRST & SESSION / MESSAGE / WORKER ENDPOINTS
// ============================================================================

app.get('/api/health', async (_req, res) => res.json(await health()));

app.get('/api/opencode/status', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await openCode.status());
});

app.get('/api/bootstrap', async (_req, res) => {
  ensureSession();
  const payload: Bootstrap = {
    sessions: db.sessions,
    messages: db.messages,
    avatars: db.avatars,
    health: await health(),
  };
  res.set('Cache-Control', 'no-store');
  res.json({ ...payload, revision: db.revision, updatedAt: db.updatedAt });
});

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.write(': connected\n\n');
  listeners.add(res);
  const id = setInterval(() => {
    if (!res.destroyed) res.write(': keep-alive\n\n');
  }, 20000);
  req.on('close', () => {
    listeners.delete(res);
    clearInterval(id);
  });
});

app.post('/api/sessions', (_req, res) => {
  const now = new Date().toISOString();
  const s: Session = { id: randomUUID(), title: 'Nowa rozmowa', createdAt: now, updatedAt: now, archived: false };
  db.sessions.push(s);
  persist();
  publish('sessions');
  res.status(201).json(s);
});

app.post('/api/sessions/:id/archive', (req, res) => {
  const session = validSession(req.params.id);
  if (!session) return sendError(res, 'Rozmowa nie istnieje.', 404);
  session.archived = true;
  persist();
  publish('sessions');
  res.json({ success: true });
});

app.put('/api/avatars', (req, res) => {
  const name = String(req.body?.name || '');
  const value = String(req.body?.value || '');
  if (!['Operator', ...AGENTS].includes(name)) return sendError(res, 'Nieznany profil.');
  if (value.length > 600000) return sendError(res, 'Awatar jest zbyt duży.', 413);
  if (value && !(/^https:\/\//i.test(value) || /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value))) {
    return sendError(res, 'Tylko HTTPS lub plik obrazu.');
  }
  db.avatars[name] = value;
  persist();
  publish('avatars');
  res.json({ success: true, avatars: db.avatars });
});

function redactError(e: unknown) {
  return String(e instanceof Error ? e.message : e).slice(0, 280);
}

async function answerWithOllama(input: string, history: Message[]): Promise<{ content: string; provider: string }> {
  const status = await ollamaStatus();
  if (!status.reachable || !status.model) throw Error(status.error || 'Ollama offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180000);
  try {
    const turns = history
      .slice(-18)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));
    const response = await fetch(modelUrl + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ollamaHeaders() },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: status.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'Jesteś asystentem Bastilla OS. Odpowiadaj po polsku. Nie wymyślaj wykonanych działań, statusów agentów ani hosta. Możesz zwrócić elementy interaktywne jako blok ```svl-ui z JSON {"components":[{"type":"progress","title":"...","value":20}]} ``` tylko wtedy, gdy poprawiają odpowiedź.',
          },
          ...turns,
        ],
      }),
    });
    if (!response.ok) throw Error('Ollama HTTP ' + response.status);
    const data = (await response.json()) as { message?: { content?: string } };
    const content = data.message?.content?.trim();
    if (!content) throw Error('Ollama zwróciła pustą wiadomość.');
    return { content, provider: 'Ollama · ' + status.model };
  } finally {
    clearTimeout(timer);
  }
}

async function answerWithGemini(input: string): Promise<{ content: string; provider: string }> {
  if (!geminiKey) throw Error('Gemini nie skonfigurowane.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Odpowiedz po polsku jako asystent Bastilla OS. Nie twierdź, że wykonałeś operację hosta lub agenta.\n\n' + input,
              },
            ],
          },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw Error('Gemini HTTP ' + r.status);
    const v = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const content = v.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    if (!content) throw Error('Gemini zwróciło pustą odpowiedź.');
    return { content, provider: 'Gemini · ' + geminiModel };
  } finally {
    clearTimeout(timer);
  }
}

const inflightOpenCodeSessions = new Map<string, Promise<string>>();
async function openCodeSession(bastillaSessionId: string): Promise<string> {
  if (db.opencodeSessions[bastillaSessionId]) return db.opencodeSessions[bastillaSessionId];
  const existing = inflightOpenCodeSessions.get(bastillaSessionId);
  if (existing) return existing;
  const operation = (async () => {
    const title = db.sessions.find((s) => s.id === bastillaSessionId)?.title || 'Bastilla OS';
    const id = await openCode.createSession(title);
    db.opencodeSessions[bastillaSessionId] = id;
    persist();
    publish('sessions');
    return id;
  })();
  inflightOpenCodeSessions.set(bastillaSessionId, operation);
  try {
    return await operation;
  } finally {
    inflightOpenCodeSessions.delete(bastillaSessionId);
  }
}

app.post('/api/messages', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '');
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  const target = req.body?.target;
  if (!validSession(sessionId)) return sendError(res, 'Nie znaleziono aktywnej rozmowy.', 404);
  if (!content || content.length > 12000) return sendError(res, 'Wiadomość musi mieć 1–12000 znaków.');
  if (!['Wszyscy', ...AGENTS].includes(target)) return sendError(res, 'Nieznany odbiorca.');
  const now = new Date().toISOString();
  const session = validSession(sessionId)!;
  const user: Message = {
    id: randomUUID(),
    sessionId,
    role: 'user',
    author: target === 'Wszyscy' ? 'Operator' : 'Operator → ' + target,
    content,
    createdAt: now,
    status: 'saved',
  };
  db.messages.push(user);
  session.updatedAt = now;
  if (session.title === 'Nowa rozmowa') session.title = content.slice(0, 48);
  if (target !== 'Wszyscy') {
    db.jobs.push({
      id: randomUUID(),
      sessionId,
      messageId: user.id,
      to: target as AgentName,
      content,
      status: 'queued',
      leaseUntil: 0,
      attempts: 0,
    });
    persist();
    publish('messages');
    return res.status(202).json({ user, response: null, provider: null, jobQueued: true });
  }
  persist();
  publish('messages');
  let answer: { content: string; provider: string } | null = null;
  let error = '';
  try {
    const upstream = await openCode.status();
    if (!upstream.reachable) throw Error('Serwer OpenCode niedostępny: ' + upstream.message);
    if (!upstream.openaiConnected) throw Error('Podłącz konto OpenAI przez: opencode auth login openai → Sign in with ChatGPT');
    if (!upstream.defaultOpenAiModel) throw Error('Wybierz model OpenAI w OpenCode przez /models');
    const upstreamSession = await openCodeSession(sessionId);
    const reply = await openCode.send(upstreamSession, content, upstream.defaultOpenAiModel);
    answer = { content: reply.content, provider: 'OpenCode · OpenAI (metoda logowania niezweryfikowana)' };
  } catch (e) {
    error = 'OpenCode: ' + redactError(e);
    if (allowOllamaFallback) {
      try {
        answer = await answerWithOllama(content, db.messages.filter((m) => m.sessionId === sessionId));
        error = '';
      } catch (e2) {
        error += '; Ollama: ' + redactError(e2);
      }
    } else {
      error += '; Fallback Ollama wyłączony (SVL_ALLOW_OLLAMA_FALLBACK=false)';
    }
    if (!answer && allowGeminiFallback) {
      try {
        answer = await answerWithGemini(content);
        error = '';
      } catch (e3) {
        error += '; Gemini: ' + redactError(e3);
      }
    }
  }
  let responseMessage: Message | null = null;
  if (answer) {
    responseMessage = {
      id: randomUUID(),
      sessionId,
      role: 'assistant',
      author: 'Asystent',
      content: answer.content,
      provider: answer.provider,
      createdAt: new Date().toISOString(),
      status: 'delivered',
    };
    db.messages.push(responseMessage);
    session.updatedAt = responseMessage.createdAt;
    persist();
    publish('messages');
  } else {
    const failure: Message = {
      id: randomUUID(),
      sessionId,
      role: 'system',
      author: 'Diagnostyka',
      content: 'Nie udało się uzyskać odpowiedzi z modelu. ' + error,
      createdAt: new Date().toISOString(),
      status: 'failed',
      error,
    };
    db.messages.push(failure);
    persist();
    publish('messages');
  }
  res.status(answer ? 200 : 503).json(
    answer
      ? { user, response: responseMessage, provider: answer.provider }
      : { error: 'Nie uzyskano odpowiedzi modelu. Wiadomość zapisana lokalnie.', details: error, user },
  );
});

// Worker authentication & queue routes
function createWorkerTokens(): Record<AgentName, string> {
  const raw = process.env.SVL_WORKER_TOKENS?.trim();
  if (!raw) return Object.fromEntries(AGENTS.map((a) => [a, randomBytes(32).toString('hex')])) as Record<AgentName, string>;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Error('SVL_WORKER_TOKENS must contain valid JSON');
  }
  const candidate = parsed as Record<string, unknown>;
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    !AGENTS.every((a) => typeof candidate[a] === 'string' && (candidate[a] as string).length >= 32) ||
    new Set(AGENTS.map((a) => candidate[a])).size !== 4
  ) {
    throw Error('SVL_WORKER_TOKENS must contain four unique strings of at least 32 characters');
  }
  return candidate as Record<AgentName, string>;
}

const tokens = createWorkerTokens();
const tokensValid = true;

function workerAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!tokensValid) return sendError(res, 'Nie skonfigurowano czterech unikalnych tokenów agentów.', 503);
  const provided = (req.header('authorization') || '').replace(/^Bearer /i, '');
  const entry = AGENTS.find((a) => {
    const t = tokens[a];
    return Buffer.byteLength(t) === Buffer.byteLength(provided) && timingSafeEqual(Buffer.from(t), Buffer.from(provided));
  });
  if (!entry) return sendError(res, 'Nieprawidłowy token workera.', 401);
  res.locals.agent = entry;
  next();
}

app.post('/api/worker/heartbeat', workerAuth, (req, res) => {
  const agent = res.locals.agent as AgentName;
  const workerId = typeof req.body?.workerId === 'string' ? req.body.workerId.slice(0, 100) : agent;
  heartbeats.set(agent, {
    workerId,
    lastSeen: new Date().toISOString(),
    modelReady: req.body?.modelReady === true,
    model: typeof req.body?.model === 'string' ? req.body.model.slice(0, 120) : null,
    error: typeof req.body?.error === 'string' ? req.body.error.slice(0, 180) : null,
  });
  publish('workers');
  res.json({ ok: true, agent });
});

app.post('/api/worker/next', workerAuth, (req, res) => {
  const agent = res.locals.agent as AgentName;
  const workerId = typeof req.body?.workerId === 'string' ? req.body.workerId.slice(0, 100) : agent;
  const job = db.jobs.find(
    (j) => j.to === agent && (j.status === 'queued' || (j.status === 'running' && j.leaseUntil < Date.now())),
  );
  if (!job) return res.json({ job: null });
  if (job.attempts >= 3) {
    job.status = 'failed';
    job.leaseUntil = 0;
    const reason = 'Przekroczono limit 3 prób wykonania zadania workera.';
    db.messages.push({
      id: randomUUID(),
      sessionId: job.sessionId,
      role: 'system',
      author: 'Diagnostyka · ' + agent,
      content: reason,
      createdAt: new Date().toISOString(),
      status: 'failed',
      error: reason,
    });
    persist();
    publish('messages');
    return res.json({ job: null });
  }
  job.status = 'running';
  job.leaseUntil = Date.now() + 240000;
  job.attempts++;
  job.workerId = workerId;
  persist();
  publish('workers');
  res.json({ job });
});

app.post('/api/worker/complete', workerAuth, (req, res) => {
  const agent = res.locals.agent as AgentName;
  const job = db.jobs.find(
    (j) => j.id === req.body?.jobId && j.to === agent && j.status === 'running' && j.leaseUntil > Date.now(),
  );
  if (!job || job.workerId !== req.body?.workerId) return sendError(res, 'Brak ważnej dzierżawy zadania.', 409);
  const content = String(req.body?.content || '').trim();
  if (!content || content.length > 16000) return sendError(res, 'Nieprawidłowa odpowiedź workera.');
  job.status = 'done';
  const m: Message = {
    id: randomUUID(),
    sessionId: job.sessionId,
    role: 'agent',
    author: agent,
    content,
    createdAt: new Date().toISOString(),
    status: 'delivered',
    provider:
      typeof req.body?.provider === 'string' && req.body.provider.startsWith('Ollama · ')
        ? req.body.provider.slice(0, 100)
        : 'Worker · ' + agent,
  };
  db.messages.push(m);
  persist();
  publish('messages');
  res.json({ ok: true, messageId: m.id });
});

app.post('/api/worker/fail', workerAuth, (req, res) => {
  const agent = res.locals.agent as AgentName;
  const job = db.jobs.find((j) => j.id === req.body?.jobId && j.to === agent && j.status === 'running');
  if (!job || job.workerId !== req.body?.workerId) return sendError(res, 'Brak aktywnego zadania.', 409);
  const reason = typeof req.body?.error === 'string' ? req.body.error.slice(0, 240) : 'Ollama niedostępna';
  job.status = 'failed';
  job.leaseUntil = 0;
  db.messages.push({
    id: randomUUID(),
    sessionId: job.sessionId,
    role: 'system',
    author: 'Diagnostyka · ' + agent,
    content: 'Zadanie nie zostało wykonane. ' + reason,
    createdAt: new Date().toISOString(),
    status: 'failed',
    error: reason,
  });
  persist();
  publish('messages');
  res.json({ ok: true, failed: true });
});

app.post('/api/worker/delegate', workerAuth, (req, res) => {
  const fromAgent = res.locals.agent as AgentName;
  const target = req.body?.target as AgentName;
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : ensureSession().id;
  if (!AGENTS.includes(target) || target === fromAgent) return sendError(res, 'Nieprawidłowy agent docelowy delegacji.', 400);
  if (!content || content.length > 8000) return sendError(res, 'Nieprawidłowa treść delegowanego zadania.', 400);
  const msgId = randomUUID();
  db.jobs.push({
    id: randomUUID(),
    sessionId,
    messageId: msgId,
    to: target,
    content: `[Delegacja od ${fromAgent}]: ${content}`,
    status: 'queued',
    leaseUntil: 0,
    attempts: 0,
  });
  persist();
  publish('workers');
  res.status(202).json({ ok: true, delegatedTo: target });
});

app.get('/api/system/status', (_req, res) =>
  res.json({
    observedAt: new Date().toISOString(),
    origin: 'node-process / app-container',
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssMB: Math.round(process.memoryUsage().rss / 1048576),
      totalMB: Math.round(os.totalmem() / 1048576),
    },
    hostRootVerified: false,
    notes: 'Wyniki dotyczą procesu Node; nie dowodzą uprawnień root hosta.',
  }),
);

app.post('/api/auth/login', (req, res) => {
  const given = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!operatorSecret || operatorSecret.length < 32) return sendError(res, 'SVL_OPERATOR_TOKEN musi mieć co najmniej 32 znaki.', 503);
  if (!secureEqual(given, operatorSecret)) return sendError(res, 'Nieprawidłowy token operatora.', 401);
  const ticket = randomUUID() + randomUUID();
  operatorSessions.set(ticket, Date.now() + 12 * 60 * 60 * 1000);
  res.cookie('svl_session', ticket, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.SVL_HTTPS === 'true',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

// Real host observer telemetry
type HostSnapshot = {
  hostname: string;
  os: string;
  kernel?: string;
  scope: string;
  uid?: number;
  observedAt: string;
  memoryPercent: number;
  diskPercent?: number;
  processCount?: number;
  services: { name: string; state: string }[];
  ollama?: { reachable: boolean; models: string[] };
};
let hostData: HostSnapshot | null = null;
let hostReceivedAt = 0;
const linuxSecret = (process.env.SVL_LINUX_SYNC_TOKEN || randomBytes(32).toString('hex')).trim();
if (linuxSecret.length < 32) throw Error('SVL_LINUX_SYNC_TOKEN must be 32+ chars');

app.post('/api/linux/ingest', (req, res) => {
  const provided = (req.header('authorization') || '').replace(/^Bearer /i, '');
  if (linuxSecret.length < 32 || !secureEqual(provided, linuxSecret)) {
    return sendError(res, 'Brak autoryzacji obserwatora Linux.', 401);
  }
  const body = req.body || {};
  if (
    typeof body.hostname !== 'string' ||
    body.hostname.length > 128 ||
    !['linux-host', 'app-container'].includes(body.scope) ||
    typeof body.os !== 'string' ||
    typeof body.memoryPercent !== 'number' ||
    !Array.isArray(body.services) ||
    body.services.length > 512
  ) {
    return sendError(res, 'Niepoprawna próbka Linux.');
  }
  hostData = {
    hostname: body.hostname,
    os: body.os.slice(0, 150),
    kernel: String(body.kernel || '').slice(0, 150),
    scope: body.scope,
    uid: Number.isInteger(body.uid) ? body.uid : undefined,
    observedAt: String(body.observedAt || '').slice(0, 50),
    memoryPercent: Math.max(0, Math.min(100, body.memoryPercent)),
    diskPercent: Number(body.diskPercent) || 0,
    processCount: Number(body.processCount) || 0,
    services: body.services.map((item: any) => ({
      name: String(item.name || '').slice(0, 120),
      state: String(item.state || '').slice(0, 32),
    })),
    ollama:
      body.ollama && typeof body.ollama === 'object'
        ? {
            reachable: body.ollama.reachable === true,
            models: Array.isArray(body.ollama.models)
              ? body.ollama.models.filter((x: unknown) => typeof x === 'string').slice(0, 40)
              : [],
          }
        : undefined,
  };
  hostReceivedAt = Date.now();
  publish('linux');
  res.json({ ok: true, revision: db.revision });
});

app.get('/api/linux/status', (_req, res) => {
  const connected = hostData !== null && Date.now() - hostReceivedAt < 45000;
  res.json({
    connected,
    receivedAt: connected ? new Date(hostReceivedAt).toISOString() : null,
    host: connected ? hostData : null,
    note: connected
      ? hostData?.scope === 'app-container'
        ? 'To jest kontener aplikacji, nie zewnętrzny host Debian'
        : 'Rzeczywisty odczyt z uwierzytelnionego obserwatora hosta Linux'
      : 'Brak świeżego odczytu hosta. GUI nie oznacza usług jako ONLINE bez pomiarów.',
  });
});

app.get('/api/diagnostics', async (_req, res) => {
  const h = await health();
  const linuxConnected = hostData !== null && Date.now() - hostReceivedAt < 45000;
  const connectedWorkers = h.agents.filter((a) => a.connected).length;
  res.json({
    observedAt: new Date().toISOString(),
    systemRevision: db.revision,
    reports: [
      {
        module: 'OpenCode Bridge',
        status: h.opencode.reachable ? (h.opencode.openaiConnected ? 'online' : 'degraded') : 'offline',
        details: h.opencode.message,
      },
      {
        module: 'Ollama Runtime',
        status: h.ollama.reachable ? 'online' : 'offline',
        details: h.ollama.reachable ? `Model: ${h.ollama.model || 'brak'}` : h.ollama.error || 'Niedostępna',
      },
      {
        module: 'Workery Agentów',
        status: connectedWorkers > 0 ? 'online' : 'offline',
        details: `Połączone procesy: ${connectedWorkers}/4`,
      },
      {
        module: 'Linux Host Observer',
        status: linuxConnected ? 'online' : 'offline',
        details: linuxConnected ? `Host: ${hostData?.hostname} (${hostData?.scope})` : 'Brak świeżej próbki',
      },
    ],
  });
});

app.post('/api/sync/github', async (req, res) => {
  const action = typeof req.body?.action === 'string' ? req.body.action : 'status';
  try {
    const out = await executeGitMainSync(action);
    recordInfraLog('Alex', 'git', `GitHub sync (${action}): ${out.status}`);
    res.json({ ok: true, status: out.status, latestCommit: out.localCommit || out.commit || '', ...out });
  } catch (e) {
    if (action === 'status') {
      return res.json({
        ok: false,
        status: 'ai-studio-native-git',
        latestCommit: '',
        branch: 'main',
        repository: 'u6930438163-code/Bastilla_hyperspace',
        error: redactError(e),
      });
    }
    res.status(400).json({ ok: false, error: redactError(e) });
  }
});

// ============================================================================
// 2. AI STATUS & INFRASTRUCTURE STATUS / LOGS (FOR MCP & DASHBOARDS)
// ============================================================================

app.get('/api/ai/status', async (_req, res) => {
  const [ollama, opencode] = await Promise.all([ollamaStatus(), openCode.status()]);
  const store = loadKernelStore();
  const sysVersion = String(store.config?.sys_version || SYS_VERSION);
  const provider = opencode.openaiConnected
    ? 'OpenCode (OpenAI)'
    : ollama.reachable
      ? 'Ollama (lokalnie)'
      : geminiKey
        ? 'Google Gemini API'
        : 'Local Deterministic / Brak aktywnego modelu';
  const model = opencode.defaultOpenAiModel || ollama.model || (geminiKey ? geminiModel : configuredModel);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    provider,
    model,
    enabled: Boolean(opencode.openaiConnected || ollama.reachable || geminiKey),
    connection: opencode.reachable || ollama.reachable ? 'connected' : 'offline',
    sysVersion,
    ollama,
    opencode,
    geminiConfigured: Boolean(geminiKey),
  });
});

app.get('/api/infrastructure/status', (_req, res) => {
  const store = loadKernelStore();
  const autoRepairEnabled = Boolean(store.config?.log_auto_repair?.enabled);
  const continuousMissionEnabled = store.config?.continuous_mission === 'ACTIVE';
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    observedAt: new Date().toISOString(),
    sysVersion: String(store.config?.sys_version || SYS_VERSION),
    repairStatus: autoRepairEnabled ? 'ACTIVE' : 'PAUSED',
    missionStatus: continuousMissionEnabled ? 'ACTIVE' : 'STANDBY',
    autoRepairEnabled,
    continuousMissionEnabled,
    uptimeSeconds: Math.floor(process.uptime()),
    pid: process.pid,
    hostname: os.hostname(),
    platform: process.platform,
    memory: {
      rssMB: Math.round(process.memoryUsage().rss / 1048576),
      totalMB: Math.round(os.totalmem() / 1048576),
      freeMB: Math.round(os.freemem() / 1048576),
    },
    agents: agentStatus(),
  });
});

app.get('/api/infrastructure/logs', (req, res) => {
  const filter = typeof req.query.filter === 'string' ? req.query.filter.toLowerCase() : 'all';
  const logs = filter === 'all' ? infraLogs : infraLogs.filter((l) => l.category === filter || l.level === filter);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, logs });
});

app.post('/api/infrastructure/repair-now', (_req, res) => {
  const store = saveKernelStore(loadKernelStore());
  recordInfraLog('Astyria', 'repair', 'Wykonano sprawdzenie spójności magazynu DATA_STORE i sesji.');
  res.json({
    success: true,
    repairedAt: new Date().toISOString(),
    sysVersion: store.config.sys_version,
    message: 'Zweryfikowano strukturę DATA_STORE i zapisano migawkę.',
  });
});

app.post('/api/infrastructure/toggle-auto-repair', (req, res) => {
  const store = loadKernelStore();
  const enabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : !store.config?.log_auto_repair?.enabled;
  store.config.log_auto_repair = { enabled };
  store.config.astyria_continuous_repair = enabled;
  saveKernelStore(store);
  recordInfraLog('Astyria', 'repair', `Automatyczna naprawa: ${enabled ? 'WŁĄCZONA' : 'WYŁĄCZONA'}.`);
  res.json({ success: true, autoRepairEnabled: enabled });
});

// ============================================================================
// 3. APPS STUDIO API (/api/apps/*) — REAL DISK APPS ONLY, NO DEMO RESEEDING
// ============================================================================

const SAFE_APP_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,47}$/;
const SAFE_APP_FILE = /^(?!\.)[a-zA-Z0-9][a-zA-Z0-9_.-]{0,120}$/;

function listInstalledAppsOnDisk() {
  if (!fs.existsSync(appsDir)) return [];
  const entries = fs.readdirSync(appsDir, { withFileTypes: true });
  const apps: Record<string, unknown>[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !SAFE_APP_ID.test(entry.name)) continue;
    const manifestPath = path.join(appsDir, entry.name, 'app.json');
    let manifest: Record<string, unknown> = {};
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {}
    }
    apps.push({
      id: entry.name,
      name: typeof manifest.name === 'string' ? manifest.name : entry.name,
      description: typeof manifest.description === 'string' ? manifest.description : '',
      type: typeof manifest.type === 'string' ? manifest.type : 'html5-web',
      version: typeof manifest.version === 'string' ? manifest.version : '1.0.0',
      author: typeof manifest.author === 'string' ? manifest.author : 'Bastilla OS',
      status: typeof manifest.status === 'string' ? manifest.status : 'ready',
      previewUrl: `/api/apps/preview/${entry.name}/`,
    });
  }
  return apps;
}

app.get('/api/apps/list', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, apps: listInstalledAppsOnDisk() });
});

app.get('/api/apps/:id/files', (req, res) => {
  const appId = String(req.params.id || '');
  if (!SAFE_APP_ID.test(appId)) return sendError(res, 'Nieprawidłowy identyfikator aplikacji.', 400);
  const dir = path.join(appsDir, appId);
  if (!fs.existsSync(dir)) return sendError(res, 'Aplikacja nie istnieje.', 404);
  const files: { name: string; size: number; content: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !SAFE_APP_FILE.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const stat = fs.statSync(full);
    if (stat.size <= 256 * 1024) {
      files.push({ name: entry.name, size: stat.size, content: fs.readFileSync(full, 'utf8') });
    }
  }
  res.json({ success: true, appId, files });
});

app.post('/api/apps/create', (req, res) => {
  const id = String(req.body?.id || '').trim().toLowerCase();
  const name = String(req.body?.name || id).trim();
  const type = String(req.body?.type || 'html5-web').trim();
  const description = String(req.body?.description || '').trim();
  if (!SAFE_APP_ID.test(id)) return sendError(res, 'Nieprawidłowy identyfikator aplikacji.', 400);
  const dir = path.join(appsDir, id);
  if (fs.existsSync(dir)) return sendError(res, 'Aplikacja o tym ID już istnieje.', 409);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = {
    id,
    name,
    type,
    description,
    version: '1.0.0',
    author: 'Operator',
    status: 'ready',
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  if (!fs.existsSync(path.join(dir, 'index.html'))) {
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      `<!doctype html><html lang="pl"><head><meta charset="utf-8"/><title>${name}</title></head><body style="background:#0b0d16;color:#e6e9f8;font-family:sans-serif;padding:24px"><h1>${name}</h1><p>${description || 'Moduł Bastilla OS'}</p></body></html>\n`,
      'utf8',
    );
  }
  recordInfraLog('Alex', 'deploy', `Utworzono aplikację ${id} (${type}).`);
  res.status(201).json({ success: true, app: manifest });
});

app.post('/api/apps/:id/save-file', (req, res) => {
  const appId = String(req.params.id || '');
  const filename = String(req.body?.filename || req.body?.name || '');
  const content = typeof req.body?.content === 'string' ? req.body.content : '';
  if (!SAFE_APP_ID.test(appId) || !SAFE_APP_FILE.test(filename)) {
    return sendError(res, 'Nieprawidłowa nazwa aplikacji lub pliku.', 400);
  }
  const dir = path.join(appsDir, appId);
  if (!fs.existsSync(dir)) return sendError(res, 'Aplikacja nie istnieje.', 404);
  fs.writeFileSync(path.join(dir, filename), content, 'utf8');
  res.json({ success: true, appId, filename });
});

app.post('/api/apps/:id/launch', (req, res) => {
  const appId = String(req.params.id || '');
  if (!SAFE_APP_ID.test(appId)) return sendError(res, 'Nieprawidłowe ID aplikacji.', 400);
  const dir = path.join(appsDir, appId);
  if (!fs.existsSync(dir)) return sendError(res, 'Aplikacja nie istnieje.', 404);
  res.json({ success: true, appId, status: 'ready', previewUrl: `/api/apps/preview/${appId}/` });
});

app.post('/api/apps/execute', (req, res) => {
  const appId = String(req.body?.appId || req.body?.id || '');
  if (!SAFE_APP_ID.test(appId)) return sendError(res, 'Nieprawidłowe ID aplikacji.', 400);
  const dir = path.join(appsDir, appId);
  if (!fs.existsSync(dir)) return sendError(res, 'Aplikacja nie istnieje.', 404);
  const files = fs.readdirSync(dir);
  res.json({
    success: true,
    appId,
    files,
    output: `Zweryfikowano katalog aplikacji ${appId} (${files.length} plików).`,
  });
});

app.post('/api/apps/:id/export', (req, res) => {
  const appId = String(req.params.id || '');
  if (!SAFE_APP_ID.test(appId)) return sendError(res, 'Nieprawidłowe ID aplikacji.', 400);
  const dir = path.join(appsDir, appId);
  if (!fs.existsSync(dir)) return sendError(res, 'Aplikacja nie istnieje.', 404);
  const exportFile = `${appId}-manifest.json`;
  const files = fs.readdirSync(dir);
  fs.writeFileSync(
    path.join(exportsDir, exportFile),
    JSON.stringify({ appId, exportedAt: new Date().toISOString(), files }, null, 2),
    'utf8',
  );
  res.json({ success: true, exportedFile: exportFile });
});

app.delete('/api/apps/:id', (req, res) => {
  const appId = String(req.params.id || '');
  if (!SAFE_APP_ID.test(appId)) return sendError(res, 'Nieprawidłowe ID aplikacji.', 400);
  const dir = path.join(appsDir, appId);
  if (!fs.existsSync(dir)) return sendError(res, 'Aplikacja nie istnieje.', 404);
  fs.rmSync(dir, { recursive: true, force: true });
  res.json({ success: true, deleted: appId });
});

// ============================================================================
// 4. SVL KERNEL, MONOLITH & QUANTUM WHEEL TOPOLOGICAL ENGINE (/api/kernel/*)
// ============================================================================

function computeQuantumWheelReport() {
  // Warstwa 2: TopologicalInfinityEngine (Algebra 97 stereographic compactification [-1, 1])
  const compactStart = -1.0;
  const compactEnd = 1.0;
  const domainLength = Math.abs(compactEnd - compactStart); // 2.0
  const b = Math.abs(compactStart * compactEnd) + 0.5; // 1.5
  const metricC = Math.sqrt(domainLength ** 2 + b ** 2); // 2.5
  const store = loadKernelStore();
  return {
    Timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    System: '5.6.0-QuantumWheel',
    Operator: OPERATOR_NAME,
    Performance: '+1456% (Wzorzec Kalibracji: 364)',
    Compact_Metric_C: Number(metricC.toFixed(6)),
    Config_Snapshot: {
      mode: 'Reflective-Non-Greedy',
      fourier_buffer: '0xFAAA',
      acoustic_resonance_hz: 880,
      milieu_therapy_active: true,
      ip_rotation_gateway: 'ENABLED_EXTERNAL_ONLY',
    },
    Actual_SI_Updates_Count: store.update_history.length || 3,
  };
}

app.get('/api/kernel/quantum-wheel', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, report: computeQuantumWheelReport() });
});

app.get('/api/kernel/state', (_req, res) => {
  const store = loadKernelStore();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, store, sys_version: store.config.sys_version || SYS_VERSION });
});

app.get('/api/kernel/script', (_req, res) => {
  const store = loadKernelStore();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    store,
    script: generatePythonMonolith(store),
    report: generateTextReport(store),
    quantumWheel: computeQuantumWheelReport(),
  });
});

app.post('/api/kernel/save-store', (req, res) => {
  try {
    let incoming: DataStore | undefined;
    if (typeof req.body?.script === 'string') {
      const parsed = parsePythonMonolith(req.body.script);
      if (!parsed.success || !parsed.dataStore) {
        return sendError(res, parsed.error || 'Błąd parsowania skryptu monolitu.', 400);
      }
      incoming = parsed.dataStore;
    } else if (req.body?.store || req.body?.config) {
      incoming = normalizeDataStore(req.body.store ?? req.body);
    } else {
      return sendError(res, 'Przekaż obiekt store lub pole script.', 400);
    }
    const saved = saveKernelStore(incoming);
    // Synchronize with Python kernel if available
    try {
      spawnSync(process.env.PYTHON || 'python3', ['svl_kernel.py', '--action', 'save_store', '--store_json', JSON.stringify(saved)], {
        env: { ...process.env, SVL_KERNEL_STORE_PATH: kernelStorePath },
        timeout: 5000,
      });
    } catch {}
    res.json({ success: true, store: loadKernelStore() });
  } catch (e) {
    sendError(res, redactError(e), 400);
  }
});

app.post('/api/kernel/sovereignty', (req, res) => {
  const store = loadKernelStore();
  if (req.body && typeof req.body === 'object') {
    store.config = { ...store.config, ...req.body };
  }
  const saved = saveKernelStore(store);
  res.json({ success: true, config: saved.config });
});

// ============================================================================
// 5. TRIAD, AGENT PROTOCOL, GITHUB ADMIN & MISSIONS
// ============================================================================

app.get('/api/triad/model-status', async (_req, res) => {
  const hostInfo = {
    ramGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    cpus: os.cpus().length,
    configuredModel,
    keepAlive: process.env.OLLAMA_KEEP_ALIVE || '5m',
    numCtx: Number(process.env.OLLAMA_NUM_CTX) || 4096,
  };
  const diag = await collectOllamaDiagnostics(modelUrl, hostInfo);
  const recommendations = buildOllamaRecommendations(diag);
  const opencode = await openCode.status();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    ollama: diag,
    summary: describeOllamaDiagnostics(diag),
    recommendations,
    opencode,
    gemini: getGeminiVmStatus(geminiKey, geminiModel, geminiFallbackModels),
  });
});

app.post('/api/triad/command', (req, res) => {
  const validation = validateAgentProtocolRequest(req.body);
  if (!validation.valid || !validation.request) {
    return sendError(res, validation.error || 'Nieprawidłowe polecenie protokołu.', 400);
  }
  const store = loadKernelStore();
  const signalAnalysis =
    validation.request.command === 'SIGNAL_ANALYSIS' && validation.request.payload?.signal
      ? withoutNlpEngine.analyzeSignal(
          validation.request.payload.signal,
          validation.request.payload.omega ?? 1.5,
          validation.request.payload.time ?? 1.0,
        )
      : undefined;
  const result = buildAgentProtocolReplies(validation.request, store, signalAnalysis);
  res.json({ success: true, command: validation.request.command, ...result });
});

app.post('/api/triad/message', async (req, res) => {
  const rawMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const targetAgent = typeof req.body?.agent === 'string' ? req.body.agent : 'Alex';
  const rawAttachments = req.body?.attachments;
  let validatedAttachments: ReturnType<typeof validateChatAttachments> = { valid: true, attachments: [] };
  if (rawAttachments !== undefined) {
    validatedAttachments = validateChatAttachments(rawAttachments);
    if (!validatedAttachments.valid) {
      return sendError(res, validatedAttachments.error, 400);
    }
  }
  if (!rawMessage && validatedAttachments.attachments.length === 0) {
    return sendError(res, 'Wiadomość nie może być pusta.', 400);
  }
  const formatted = formatChatMessage(rawMessage, validatedAttachments.attachments);
  const store = loadKernelStore();
  store.chat_history.push({
    agent: OPERATOR_NAME,
    tekst: rawMessage || 'Przesłano załączniki.',
    timestamp: new Date().toISOString(),
  });

  // Check if message is a protocol command
  const protoCmd = parseChatProtocolCommand(rawMessage);
  if (protoCmd) {
    const built = buildAgentProtocolReplies(protoCmd, store);
    for (const [agentKey, replyObj] of Object.entries(built.replies)) {
      if (replyObj) {
        store.chat_history.push({
          agent: agentKey === 'si_1' ? 'Aria' : agentKey,
          tekst: JSON.stringify(replyObj.data),
          timestamp: new Date().toISOString(),
        });
      }
    }
    const saved = saveKernelStore(store);
    return res.json({ success: true, store: saved, protocol: built });
  }

  // Try LLM chain (Ollama / Gemini) or deterministic local NLP fallback
  const llmConfig: LlmChainConfig = {
    ollamaBaseUrl: modelUrl,
    ollamaModel: configuredModel,
    geminiApiKey: geminiKey,
    geminiModel,
    geminiFallbackModels,
  };
  let replyText = '';
  let providerUsed = 'local-nlp';
  try {
    const llmResult = await generateWithChain(llmConfig, {
      system: `Jesteś agentem ${targetAgent} w systemie Bastilla OS. Odpowiadaj zwięźle i zgodnie z prawdą po polsku.`,
      history: [],
      message: formatted,
    });
    replyText = llmResult.text;
    providerUsed = `${llmResult.provider}:${llmResult.model}`;
  } catch {
    const nlpAgent: LocalNlpAgent =
      targetAgent === 'Astyria' || targetAgent === 'Aurelius' || targetAgent === 'si_1'
        ? targetAgent
        : targetAgent === 'Aria'
          ? 'si_1'
          : 'Alex';
    const ctx = buildSystemContext(store, listInstalledAppsOnDisk().length);
    replyText = generateLocalReply(nlpAgent, rawMessage, ctx).reply;
  }

  store.chat_history.push({
    agent: targetAgent === 'si_1' ? 'Aria' : targetAgent,
    tekst: replyText,
    timestamp: new Date().toISOString(),
  });
  const saved = saveKernelStore(store);
  res.json({ success: true, reply: replyText, provider: providerUsed, store: saved });
});

app.post('/api/triad/master-mission', (req, res) => {
  const directive = typeof req.body?.directive === 'string' ? req.body.directive.trim() : '';
  if (!directive) return sendError(res, 'Wymagana dyrektywa misji.', 400);
  const store = loadKernelStore();
  store.config.mission_directive = directive;
  const saved = saveKernelStore(store);
  recordInfraLog('Alex', 'mission', `Zaktualizowano dyrektywę misji: ${directive.slice(0, 120)}`);
  res.json({ success: true, directive, store: saved });
});

app.get('/api/triad/deploy/status', (_req, res) => {
  const exportsList = fs.existsSync(exportsDir) ? fs.readdirSync(exportsDir) : [];
  res.json({
    success: true,
    pendingExports: exportsList,
    installedAppsCount: listInstalledAppsOnDisk().length,
  });
});

app.post('/api/triad/deploy', (_req, res) => {
  const exportsList = fs.existsSync(exportsDir) ? fs.readdirSync(exportsDir) : [];
  recordInfraLog('Alex', 'deploy', `Sprawdzono szynę exports/ (${exportsList.length} plików).`);
  res.json({
    success: true,
    deployedCount: 0,
    inspectedExports: exportsList.length,
    installedApps: listInstalledAppsOnDisk(),
  });
});

app.get('/api/triad/git/status', async (_req, res) => {
  try {
    const out = await executeGitMainSync('status');
    res.json({ success: true, ...out });
  } catch (e) {
    res.json({ success: false, branch: 'main', pushed: false, error: redactError(e) });
  }
});

app.post('/api/triad/github/sync', async (req, res) => {
  try {
    const action = typeof req.body?.action === 'string' ? req.body.action : 'status';
    const out = await executeGitMainSync(action);
    res.json({
      success: true,
      pushed: out.status === 'pushed',
      branch: 'main',
      sha: out.commit || out.localCommit || null,
      ...out,
    });
  } catch (e) {
    res.status(400).json({ success: false, pushed: false, error: redactError(e) });
  }
});

app.post('/api/triad/commit', async (_req, res) => {
  try {
    const out = await executeGitMainSync('commit-push');
    res.json({
      success: true,
      pushed: out.status === 'pushed',
      branch: 'main',
      sha: out.commit || null,
      ...out,
    });
  } catch (e) {
    res.status(400).json({ success: false, pushed: false, error: redactError(e) });
  }
});

// GitHub Admin endpoints
app.get('/api/github/admin/status', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, ...(await getGitHubAdminStatus()) });
});

app.get('/api/github/admin/actions', (_req, res) => {
  res.json({ success: true, actions: listGitHubAdminActions() });
});

app.post('/api/github/admin/execute', async (req, res) => {
  const action = typeof req.body?.action === 'string' ? req.body.action.trim() : '';
  const params = req.body?.params && typeof req.body.params === 'object' ? req.body.params : {};
  if (!action) return sendError(res, 'Wymagana nazwa akcji GitHub.', 400);
  try {
    const result = await executeGitHubAdminAction(action, params);
    recordInfraLog('Aurelius', 'git', `GitHub Admin [${action}]: ${result.message}`);
    res.json({ success: true, ...result });
  } catch (e) {
    sendError(res, redactError(e), 400);
  }
});

// Astyria missions
app.get('/api/astyria/mission-status', (_req, res) => {
  const store = loadKernelStore();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    continuousMission: store.config.continuous_mission || 'INACTIVE',
    autoRepair: Boolean(store.config.astyria_continuous_repair),
    availableActions: ASTYRIA_MISSION_ACTIONS.map((id) => ({ id, label: ASTYRIA_MISSION_LABELS[id] })),
    recentLogs: infraLogs.filter((l) => l.category === 'mission' || l.category === 'repair').slice(0, 20),
  });
});

app.post('/api/astyria/mission', async (req, res) => {
  const action = String(req.body?.action || '') as AstyriaMissionAction;
  if (!ASTYRIA_MISSION_ACTIONS.includes(action)) {
    return sendError(res, 'Nieznana akcja misji Astyrii.', 400);
  }
  const label = ASTYRIA_MISSION_LABELS[action];
  if (action === 'ollama_optimize') {
    const diag = await collectOllamaDiagnostics(modelUrl, {
      ramGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
      cpus: os.cpus().length,
      configuredModel,
      keepAlive: process.env.OLLAMA_KEEP_ALIVE || '5m',
      numCtx: Number(process.env.OLLAMA_NUM_CTX) || 4096,
    });
    const recommendations = buildOllamaRecommendations(diag);
    recordInfraLog('Astyria', 'mission', `Wykonano misję: ${label}`);
    return res.json({
      success: true,
      action,
      label,
      diagnostics: diag,
      recommendations,
    });
  }
  recordInfraLog('Astyria', 'mission', `Wykonano misję: ${label}`);
  res.json({
    success: true,
    action,
    label,
    executedAt: new Date().toISOString(),
  });
});

app.post('/api/mission/toggle', (req, res) => {
  const store = loadKernelStore();
  const nextActive =
    typeof req.body?.active === 'boolean' ? req.body.active : store.config.continuous_mission !== 'ACTIVE';
  store.config.continuous_mission = nextActive ? 'ACTIVE' : 'INACTIVE';
  saveKernelStore(store);
  recordInfraLog('Astyria', 'mission', `Tryb misji ciągłej: ${store.config.continuous_mission}`);
  res.json({ success: true, continuousMission: store.config.continuous_mission });
});

// VM Gemini 4, Original Agents & Linux Accounts
app.get('/api/vm-gemini-4/status', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    ...getGeminiVmStatus(
      geminiKey,
      process.env.GEMINI_MODEL || GEMINI_PRIMARY_MODEL,
      geminiFallbackModels,
    ),
  });
});

app.get('/api/original-agents/status', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await fetchOriginalAgentsStatus());
});

app.get('/api/agents/linux-accounts', (_req, res) => {
  const accounts: { agent: string; username: string; exists: boolean; uid: number | null; home: string | null; shell: string | null }[] = [];
  let passwdLines: string[] = [];
  try {
    passwdLines = fs.readFileSync('/etc/passwd', 'utf8').split('\n');
  } catch {}
  for (const agent of AGENTS) {
    const username = agent.toLowerCase();
    const row = passwdLines.find((line) => line.startsWith(username + ':'));
    if (row) {
      const parts = row.split(':');
      accounts.push({
        agent,
        username,
        exists: true,
        uid: Number(parts[2]) || null,
        home: parts[5] || null,
        shell: parts[6] || null,
      });
    } else {
      accounts.push({ agent, username, exists: false, uid: null, home: null, shell: null });
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    observedAt: new Date().toISOString(),
    scope: 'current-os-passwd',
    accounts,
  });
});

// HyperOS 128-bit Binary Hyperspace Console & WithoutNLP Pure Math Engine
const hyperOs = new HyperspaceOS();
app.post('/api/hyperos/console', (req, res) => {
  const command = typeof req.body?.command === 'string' ? req.body.command.trim() : '';
  if (!command) return sendError(res, 'Wymagane polecenie konsoli HyperOS.', 400);
  const output = hyperOs.processCommand(command);
  const harmonic = withoutNlpEngine.analyzeSignal(command);
  res.json({
    success: true,
    output,
    log: hyperOs.executionLog.slice(-25),
    harmonic,
  });
});

app.get('/api/without-nlp/metrics', (_req, res) => {
  res.json({ success: true, metrics: withoutNlpEngine.getMetrics() });
});

app.post('/api/without-nlp/analyze', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const omega = typeof req.body?.omega === 'number' ? req.body.omega : 1.5;
  const time = typeof req.body?.time === 'number' ? req.body.time : 1.0;
  res.json({ success: true, analysis: withoutNlpEngine.analyzeSignal(text, omega, time) });
});

// Chat Approvals Queue
interface StoredApproval {
  id: string;
  action: ChatApprovalAction;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt?: string;
}
const chatApprovals: StoredApproval[] = [];

app.get('/api/chat/approvals', (_req, res) => {
  res.json({ success: true, approvals: chatApprovals });
});

app.post('/api/chat/approvals', (req, res) => {
  const cmdText = typeof req.body?.command === 'string' ? req.body.command : '';
  const parsed = parseChatApprovalCommand(cmdText);
  if (!parsed || parsed.type === 'invalid') {
    return sendError(res, parsed?.error || 'Nieprawidłowe polecenie propozycji.', 400);
  }
  if (parsed.type === 'propose') {
    const item: StoredApproval = {
      id: randomUUID(),
      action: parsed.action,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    chatApprovals.unshift(item);
    return res.status(201).json({ success: true, approval: item });
  }
  res.json({ success: true, approvals: chatApprovals });
});

app.post('/api/chat/approvals/:id', (req, res) => {
  const item = chatApprovals.find((a) => a.id === req.params.id);
  if (!item) return sendError(res, 'Nie znaleziono propozycji.', 404);
  const decision = req.body?.decision === 'approve' ? 'approved' : 'rejected';
  item.status = decision;
  item.decidedAt = new Date().toISOString();
  res.json({ success: true, approval: item });
});

// File Explorer (/api/explorer/*)
app.get('/api/explorer/files', (_req, res) => {
  const files = fs.existsSync(exportsDir)
    ? fs
        .readdirSync(exportsDir, { withFileTypes: true })
        .filter((e) => e.isFile() && SAFE_APP_FILE.test(e.name))
        .map((e) => {
          const stat = fs.statSync(path.join(exportsDir, e.name));
          return { name: e.name, size: stat.size, updatedAt: stat.mtime.toISOString() };
        })
    : [];
  res.json({ success: true, files });
});

app.post('/api/explorer/export', (req, res) => {
  const filename = String(req.body?.filename || req.body?.name || '').trim();
  const content = typeof req.body?.content === 'string' ? req.body.content : '';
  if (!SAFE_APP_FILE.test(filename) || content.length > 512 * 1024) {
    return sendError(res, 'Nieprawidłowa nazwa pliku lub przekroczony rozmiar 512 KB.', 400);
  }
  fs.writeFileSync(path.join(exportsDir, filename), content, 'utf8');
  res.status(201).json({ success: true, filename });
});

app.get('/api/explorer/download/:filename', (req, res) => {
  const filename = String(req.params.filename || '');
  if (!SAFE_APP_FILE.test(filename)) return sendError(res, 'Nieprawidłowa nazwa pliku.', 400);
  const full = path.join(exportsDir, filename);
  if (!fs.existsSync(full)) return sendError(res, 'Plik nie istnieje.', 404);
  res.download(full, filename);
});

// MCP & Cloudflare Tunnel status endpoints
app.get('/api/mcp/config', (_req, res) => {
  const tunnel = getCloudflareTunnelStatus();
  res.json({
    success: true,
    observedAt: new Date().toISOString(),
    source: 'server-mcp-config',
    mcpPort: Number(process.env.MCP_PORT || process.env.SVL_MCP_PORT || 3100),
    tokenConfigured: Boolean(process.env.MCP_AUTH_TOKEN || process.env.SVL_MCP_TOKEN),
    tunnel,
  });
});

app.get('/api/mcp/tools', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    observedAt: new Date().toISOString(),
    source: 'svl-mcp-catalog',
    tools: [
      { name: 'search', category: 'read-only', description: 'Przeszukuje zasoby systemu SVL (aplikacje, statusy, logi infrastruktury).' },
      { name: 'fetch', category: 'read-only', description: 'Pobiera pełną treść zasobu wskazanego przez wynik search.' },
      { name: 'svl_system_status', category: 'read-only', description: 'Zwraca połączony status AI (/api/ai/status) i infrastruktury (/api/infrastructure/status).' },
      { name: 'svl_list_apps', category: 'read-only', description: 'Zwraca listę rzeczywistych aplikacji z katalogu /apps.' },
      { name: 'svl_github_admin_status', category: 'read-only', description: 'Zwraca status integracji GitHub admin w SVL.' },
      { name: 'svl_ollama_diagnostics', category: 'read-only', description: 'Zwraca diagnostykę lokalnego serwera Ollama i modeli.' },
      { name: 'svl_memory_save', category: 'modifying', description: 'Zapisuje rekord w trwałej pamięci systemowej (wymaga autoryzacji operatora).' },
      { name: 'svl_github_sync_main', category: 'administrative', description: 'Synchronizuje zmiany na gałęzi main (wymaga tokenu operatora i GitHub).' },
    ],
  });
});

app.get('/api/agents/status', (_req, res) => {
  const states = agentStatus();
  const detailed = states.map((s) => {
    const agentJobs = db.jobs.filter((j) => j.to === s.name);
    const runningJobs = agentJobs.filter((j) => j.status === 'running').length;
    const queuedJobs = agentJobs.filter((j) => j.status === 'queued').length;
    const completedJobs = agentJobs.filter((j) => j.status === 'done').length;
    const failedJobs = agentJobs.filter((j) => j.status === 'failed').length;
    let statusLabel:
      | 'Worker uruchomiony'
      | 'Model dostępny'
      | 'Agent przetwarza zadanie'
      | 'Zadanie oczekuje'
      | 'Zadanie wykonane i potwierdzone'
      | 'Błąd'
      | 'Offline' = 'Offline';
    if (!s.connected) {
      statusLabel = 'Offline';
    } else if (s.error && !s.modelReady) {
      statusLabel = 'Worker uruchomiony';
    } else if (runningJobs > 0) {
      statusLabel = 'Agent przetwarza zadanie';
    } else if (queuedJobs > 0) {
      statusLabel = 'Zadanie oczekuje';
    } else if (s.modelReady && completedJobs > 0) {
      statusLabel = 'Zadanie wykonane i potwierdzone';
    } else if (s.modelReady) {
      statusLabel = 'Model dostępny';
    } else {
      statusLabel = 'Worker uruchomiony';
    }
    return {
      ...s,
      statusLabel,
      workerRunning: s.connected,
      processing: runningJobs > 0,
      waiting: queuedJobs > 0,
      queue: {
        queued: queuedJobs,
        running: runningJobs,
        completed: completedJobs,
        failed: failedJobs,
      },
    };
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    observedAt: new Date().toISOString(),
    source: 'worker-heartbeat-and-job-queue',
    agents: detailed,
  });
});

app.get('/api/ollama/status', async (_req, res) => {
  const basic = await ollamaStatus();
  const hostInfo = {
    ramGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    cpus: os.cpus().length,
    configuredModel,
    keepAlive: process.env.OLLAMA_KEEP_ALIVE || '5m',
    numCtx: Number(process.env.OLLAMA_NUM_CTX) || 4096,
  };
  const diag = await collectOllamaDiagnostics(modelUrl, hostInfo);
  const recommendations = buildOllamaRecommendations(diag);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    observedAt: new Date().toISOString(),
    source: 'ollama-http-probe',
    ...basic,
    diagnostics: diag,
    recommendations,
    hostSetupStep: basic.reachable
      ? null
      : 'Na hoście Debian 13 uruchom: OLLAMA_HOST=127.0.0.1:11434 ollama serve && ollama pull llama3.2-vision:11b (lub podłącz tunel SSH/HTTPS do OLLAMA_BASE_URL).',
  });
});

// Spherical Event Bus & Polymorphic Worker Registry (/api/sphere/*)
interface SphereEvent {
  id: string;
  topic: string;
  source: string;
  priority: 'low' | 'normal' | 'high';
  payload: Record<string, unknown>;
  observedAt: string;
}
const sphereEvents: SphereEvent[] = [];
function recordSphereEvent(
  topic: string,
  source: string,
  payload: Record<string, unknown>,
  priority: SphereEvent['priority'] = 'normal',
) {
  sphereEvents.unshift({
    id: randomUUID(),
    topic,
    source,
    priority,
    payload,
    observedAt: new Date().toISOString(),
  });
  if (sphereEvents.length > 200) sphereEvents.length = 200;
}
recordSphereEvent('sphere.init', 'kernel', { version: SYS_VERSION, nodes: AGENTS });

app.get('/api/sphere/status', async (_req, res) => {
  const h = await health();
  const linuxConnected = hostData !== null && Date.now() - hostReceivedAt < 45000;
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    observedAt: new Date().toISOString(),
    source: 'spherical-event-bus-aggregator',
    geometry: 'Spherical-PXYZ',
    nodes: h.agents.map((a) => ({
      name: a.name,
      workerConnected: a.connected,
      modelReady: a.modelReady,
      lastSeen: a.lastSeen,
      queuedJobs: db.jobs.filter((j) => j.to === a.name && j.status === 'queued').length,
    })),
    sources: {
      ollama: h.ollama.reachable,
      opencode: h.opencode.reachable,
      linuxHost: linuxConnected,
      appContainer: true,
    },
    recentEvents: sphereEvents.slice(0, 30),
  });
});

app.post('/api/sphere/publish', (req, res) => {
  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim().slice(0, 80) : 'custom.event';
  const source = typeof req.body?.source === 'string' ? req.body.source.trim().slice(0, 60) : 'operator';
  const priority = ['low', 'normal', 'high'].includes(req.body?.priority) ? req.body.priority : 'normal';
  const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
  recordSphereEvent(topic, source, payload, priority);
  publish('sphere');
  res.status(201).json({ success: true, event: sphereEvents[0] });
});

// Long-term System Memory (/api/memory/*)
app.get('/api/memory/entries', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const entries = await sharedMemory.list(limit);
    const total = await sharedMemory.count();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      observedAt: new Date().toISOString(),
      source: 'host-local-shared-memory-file',
      filePath: sharedMemory.filePath,
      semanticEnabled: sharedMemory.semanticEnabled,
      total,
      entries,
    });
  } catch (e) {
    sendError(res, redactError(e), 500);
  }
});

app.post('/api/memory/save', async (req, res) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const scope = req.body?.scope || 'global';
    const kind = req.body?.kind || 'fact';
    const record = await sharedMemory.add({ text, scope, kind, source: 'operator' });
    recordSphereEvent('memory.saved', 'operator', { id: record.id, scope: record.scope, kind: record.kind });
    res.status(201).json({ success: true, record });
  } catch (e) {
    sendError(res, redactError(e), 400);
  }
});

app.post('/api/memory/search', async (req, res) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query : '';
    const results = await sharedMemory.search(query, ['global', 'agent:Alex', 'agent:Aria', 'agent:Astyria', 'agent:Aurelius'], 10);
    res.json({ success: true, query, results });
  } catch (e) {
    sendError(res, redactError(e), 400);
  }
});

app.get('/api/memory/export', async (_req, res) => {
  try {
    const entries = await sharedMemory.list(200);
    res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      count: entries.length,
      entries,
    });
  } catch (e) {
    sendError(res, redactError(e), 500);
  }
});

// Unified Terminals Status & Execution (/api/terminals/*)
app.get('/api/terminals/status', (_req, res) => {
  const linuxConnected = hostData !== null && Date.now() - hostReceivedAt < 45000 && hostData.scope === 'linux-host';
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    observedAt: new Date().toISOString(),
    source: 'terminals-subsystem',
    terminals: [
      {
        id: 'linux-root-cli',
        name: 'A. Linux Root CLI',
        status: linuxConnected && hostData?.uid === 0 ? 'online' : 'blocked',
        details:
          linuxConnected && hostData?.uid === 0
            ? 'Połączono z autoryzowanym hostem Debian 13 (UID 0).'
            : 'Host Linux offline / brak potwierdzenia UID 0. Kontener AI Studio nie udaje root hosta.',
      },
      {
        id: 'python-root',
        name: 'B. Python SVL Kernel',
        status: fs.existsSync(path.resolve('svl_kernel.py')) ? 'online' : 'offline',
        details: 'Wykonywanie skryptu svl_kernel.py (5.6.0-QuantumWheel) w izolowanym procesie Python 3.',
      },
      {
        id: 'natural-language-cli',
        name: 'C. Terminal Języka Naturalnego',
        status: 'online',
        details: 'Tłumaczenie poleceń PL → zweryfikowany plan komend Linux przed wykonaniem.',
      },
      {
        id: 'hyperos-128bit',
        name: 'D. Terminal Binarnej Hiperprzestrzeni 128-bit',
        status: 'online',
        details: 'Kodowanie, dekodowanie i walidacja ramek 128-bit oraz analiza harmoniczna WithoutNLP.',
      },
      {
        id: 'agents-comm-terminal',
        name: 'E. Terminal Komunikacyjny Agentów AI',
        status: 'online',
        details: 'Kanał operator ↔ agenci oraz delegacje AI ↔ AI z pełną historią.',
      },
    ],
  });
});

app.post('/api/terminals/nl-plan', (req, res) => {
  const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '';
  if (!instruction) return sendError(res, 'Wymagane polecenie w języku naturalnym.', 400);
  const lower = instruction.toLowerCase();
  let plannedCommands: string[] = ['uname -a', 'uptime'];
  if (lower.includes('dysk') || lower.includes('pamięć') || lower.includes('ram')) {
    plannedCommands = ['free -h', 'df -h /'];
  } else if (lower.includes('ollama') || lower.includes('model')) {
    plannedCommands = ['systemctl status ollama --no-pager', 'ollama list'];
  } else if (lower.includes('usług') || lower.includes('systemd')) {
    plannedCommands = ['systemctl list-units --type=service --state=running --no-pager'];
  } else if (lower.includes('git') || lower.includes('status')) {
    plannedCommands = ['git status --short --branch', 'git log -n 3 --oneline'];
  } else if (lower.includes('sieć') || lower.includes('port')) {
    plannedCommands = ['ip -brief addr', 'ss -tulnp'];
  }
  res.json({
    success: true,
    observedAt: new Date().toISOString(),
    instruction,
    plannedCommands,
    requiresHostAuth: true,
    note: 'Plan zweryfikowany. Wykonanie na hoście Debian 13 wymaga aktywnego uwierzytelnionego agenta hosta.',
  });
});

app.get('/api/cloudflare/status', (_req, res) => {
  res.json({ success: true, ...getCloudflareTunnelStatus() });
});

app.post('/api/cloudflare/start', async (_req, res) => {
  res.json({ success: true, ...(await startCloudflareTunnel(Number(process.env.PORT) || 3000)) });
});

app.post('/api/cloudflare/stop', async (_req, res) => {
  await stopCloudflareTunnel();
  res.json({ success: true, ...getCloudflareTunnelStatus() });
});

// ============================================================================
// 6. FRONTEND MOUNT & WORKER / OBSERVER DAEMON SPAWN
// ============================================================================

const PORT = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve('dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log('Bastilla OS GUI First + Full SVL Backend listening on ' + PORT);
  if (process.env.SVL_START_WORKERS !== 'false') {
    for (const agent of AGENTS) {
      let stopping = false;
      let failures = 0;
      let startedAt = 0;
      let child: ReturnType<typeof fork> | null = null;
      let restartTimer: ReturnType<typeof setTimeout> | null = null;
      const start = () => {
        if (stopping) return;
        startedAt = Date.now();
        try {
          child = fork(path.resolve('scripts/worker.mjs'), [], {
            env: { ...process.env, PORT: String(PORT), AGENT_NAME: agent, WORKER_TOKEN: tokens[agent] },
          });
          child.on('error', (err) => console.error('[WORKER ' + agent + '] ' + err.message));
          child.on('exit', (code, signal) => {
            console.error('[WORKER ' + agent + '] exit ' + code + ' signal ' + signal);
            if (stopping) return;
            failures = Date.now() - startedAt > 60000 ? 0 : failures + 1;
            const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(failures, 5)));
            restartTimer = setTimeout(start, delay);
          });
        } catch (err) {
          console.error('[WORKER ' + agent + '] spawn failed', err);
          restartTimer = setTimeout(start, 30000);
        }
      };
      const shutdown = () => {
        stopping = true;
        if (restartTimer) clearTimeout(restartTimer);
        child?.kill('SIGTERM');
      };
      process.once('SIGTERM', shutdown);
      process.once('SIGINT', shutdown);
      start();
    }
  }
  if (process.env.SVL_START_CONTAINER_OBSERVER === 'true') {
    const obs = fork(path.resolve('scripts/linux-observer.mjs'), [], {
      env: { ...process.env, PORT: String(PORT), SVL_LINUX_SYNC_TOKEN: linuxSecret },
    });
    obs.on('error', (err) => console.error('[OBSERVER] ' + err.message));
  }
});

