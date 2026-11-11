import type { AgentName, Bootstrap, Message, ServerHealth, Session } from './types';

export class ApiFailure extends Error {
  constructor(
    message: string,
    public code: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({ error: 'Odpowiedź serwera nie jest prawidłowym JSON.' }));
  if (!response.ok) throw new ApiFailure(result.error || `HTTP ${response.status}`, response.status);
  return result as T;
}

export const api = {
  login: (token: string) => request<{ ok: boolean }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ token }) }),
  linuxStatus: () => request<{ connected: boolean; receivedAt: string | null; host: unknown; note?: string }>('/api/linux/status'),
  bootstrap: () => request<Bootstrap>('/api/bootstrap'),
  health: () => request<ServerHealth>('/api/health'),
  opencodeStatus: () => request<ServerHealth['opencode']>('/api/opencode/status'),
  ollamaStatus: () => request<any>('/api/ollama/status'),
  agentsStatus: () => request<{ success: boolean; observedAt: string; agents: any[] }>('/api/agents/status'),
  sphereStatus: () => request<any>('/api/sphere/status'),
  terminalsStatus: () => request<{ success: boolean; terminals: { id: string; name: string; status: string; details: string }[] }>('/api/terminals/status'),
  runQuantumWheel: () => request<{ success: boolean; report: any }>('/api/kernel/quantum-wheel'),
  runHyperOs: (command: string) => request<{ success: boolean; output: string; log: string[]; harmonic: any }>('/api/hyperos/console', { method: 'POST', body: JSON.stringify({ command }) }),
  runNlPlan: (instruction: string) => request<{ success: boolean; instruction: string; plannedCommands: string[]; note: string }>('/api/terminals/nl-plan', { method: 'POST', body: JSON.stringify({ instruction }) }),
  memoryEntries: () => request<{ success: boolean; total: number; filePath: string; entries: any[] }>('/api/memory/entries'),
  saveMemory: (text: string, scope = 'global', kind = 'fact') => request<{ success: boolean; record: any }>('/api/memory/save', { method: 'POST', body: JSON.stringify({ text, scope, kind }) }),
  mcpTools: () => request<{ success: boolean; tools: { name: string; category: string; description: string }[] }>('/api/mcp/tools'),
  appsList: () => request<{ success: boolean; apps: { id: string; name: string; description: string; type: string; version: string; previewUrl: string }[] }>('/api/apps/list'),
  createSession: () => request<Session>('/api/sessions', { method: 'POST', body: '{}' }),
  archiveSession: (id: string) => request<{ success: boolean }>(`/api/sessions/${encodeURIComponent(id)}/archive`, { method: 'POST', body: '{}' }),
  sendMessage: (sessionId: string, content: string, target: 'Wszyscy' | AgentName) =>
    request<{ user: Message; response: Message | null; provider: string | null }>(`/api/messages`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, content, target }),
    }),
  updateAvatar: (name: string, value: string) =>
    request<{ success: boolean; avatars: Record<string, string> }>('/api/avatars', {
      method: 'PUT',
      body: JSON.stringify({ name, value }),
    }),
  getDiagnostics: () =>
    request<{ observedAt: string; reports: { module: string; status: string; details: string }[]; systemRevision: number }>(
      '/api/diagnostics',
    ),
  githubSync: (action = 'status') =>
    request<{ ok: boolean; status: string; latestCommit: string; branch?: string; localCommit?: string; remoteCommit?: string }>(
      '/api/sync/github',
      { method: 'POST', body: JSON.stringify({ action }) },
    ),
};
