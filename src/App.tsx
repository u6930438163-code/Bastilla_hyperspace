import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Cpu,
  HardDrive,
  History,
  ImagePlus,
  Layers3,
  Menu,
  MessageCirclePlus,
  RefreshCcw,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Signal,
  Sparkles,
  Terminal,
  UserRound,
  X,
} from 'lucide-react';
import { api, ApiFailure } from './lib/api';
import type { AgentName, Bootstrap, Session } from './lib/types';
import { BLOCK_DEMOS, RichBlock, RichContent, UI_GROUPS, UI_TYPES } from './components/RichBlocks';
import './index.css';

const AGENTS: AgentName[] = ['Alex', 'Aria', 'Astyria', 'Aurelius'];
const welcome = [
  'Zacznij od pytania lub polecenia',
  'Zaloguj ChatGPT w OpenCode',
  'Wybierz gotowy interaktywny blok',
  'Sprawdź rzeczywisty stan Linux i Ollamy',
];

function humanTime(value: string | null | undefined) {
  if (!value) return 'brak';
  const d = new Date(value);
  return Number.isFinite(d.valueOf()) ? d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : 'brak';
}

function InitialAvatar({ name, avatar, size = 34 }: { name: string; avatar?: string; size?: number }) {
  return avatar ? (
    <img className="avatar" alt={name} src={avatar} width={size} height={size} />
  ) : (
    <span className={'avatar-text avatar-' + name.toLowerCase()} style={{ width: size, height: size }}>
      {name === 'Operator' ? <UserRound size={size * 0.5} /> : name.slice(0, 1)}
    </span>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return <span className={'presence ' + (online ? 'live' : 'idle')} />;
}

function App() {
  const [snapshot, setSnapshot] = useState<Bootstrap | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [recipient, setRecipient] = useState<'Wszyscy' | AgentName>('Wszyscy');
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [panel, setPanel] = useState<'none' | 'system' | 'agents' | 'library' | 'settings'>('none');
  const [drawer, setDrawer] = useState(false);
  const [viewArchive, setViewArchive] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryType, setLibraryType] = useState('card');
  const [loginToken, setLoginToken] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [syncState, setSyncState] = useState<'online' | 'connecting' | 'offline'>('connecting');
  const [hostSnapshot, setHostSnapshot] = useState<any>(null);
  const [serviceFilter, setServiceFilter] = useState('');
  const [avatarEdit, setAvatarEdit] = useState('Operator');
  const [avatarValue, setAvatarValue] = useState('');

  // Extended live backend states
  const [agentsDetail, setAgentsDetail] = useState<any[]>([]);
  const [terminalsList, setTerminalsList] = useState<any[]>([]);
  const [quantumReport, setQuantumReport] = useState<any>(null);
  const [hyperCmd, setHyperCmd] = useState('STATUS');
  const [hyperOut, setHyperOut] = useState('');
  const [nlInput, setNlInput] = useState('');
  const [nlPlan, setNlPlan] = useState<string[]>([]);
  const [gitState, setGitState] = useState<any>(null);
  const [memoryList, setMemoryList] = useState<any[]>([]);
  const [memoryInput, setMemoryInput] = useState('');
  const [appsCatalog, setAppsCatalog] = useState<any[]>([]);
  const [mcpCatalog, setMcpCatalog] = useState<any[]>([]);

  const bottom = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const lastRevision = useRef(0);
  const lastUpdated = useRef(0);
  const textbox = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (silent = false) => {
    try {
      const payload = await api.bootstrap();
      lastUpdated.current = Date.now();
      lastRevision.current = payload.revision ?? lastRevision.current;
      setSnapshot(payload);
      setSyncState('online');
      setNeedsLogin(false);
      if (!silent) setError('');
      setSessionId((old) =>
        old && payload.sessions.some((s) => s.id === old && !s.archived)
          ? old
          : payload.sessions.filter((s) => !s.archived).at(-1)?.id || '',
      );
    } catch (e) {
      setSyncState('offline');
      if (e instanceof ApiFailure && e.code === 401) setNeedsLogin(true);
      if (!silent) setError(e instanceof Error ? e.message : 'Backend jest niedostępny');
    }
  }, []);

  const refreshHost = useCallback(async () => {
    try {
      const [status, ag, terms, apps, mcp] = await Promise.all([
        api.linuxStatus(),
        api.agentsStatus().catch(() => ({ agents: [] })),
        api.terminalsStatus().catch(() => ({ terminals: [] })),
        api.appsList().catch(() => ({ apps: [] })),
        api.mcpTools().catch(() => ({ tools: [] })),
      ]);
      setHostSnapshot(status);
      if (Array.isArray(ag.agents)) setAgentsDetail(ag.agents);
      if (Array.isArray(terms.terminals)) setTerminalsList(terms.terminals);
      if (Array.isArray(apps.apps)) setAppsCatalog(apps.apps);
      if (Array.isArray(mcp.tools)) setMcpCatalog(mcp.tools);
    } catch {
      setHostSnapshot(null);
    }
  }, []);

  const refreshExtendedSystem = useCallback(async () => {
    try {
      const [mem, git] = await Promise.all([
        api.memoryEntries().catch(() => ({ entries: [] })),
        api.githubSync('status').catch(() => null),
      ]);
      if (Array.isArray(mem.entries)) setMemoryList(mem.entries);
      if (git) setGitState(git);
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
    void refreshHost();
    void refreshExtendedSystem();
    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    const connect = () => {
      source?.close();
      setSyncState('connecting');
      source = new EventSource('/api/events');
      source.addEventListener('update', () => {
        void refresh(true);
        void refreshHost();
      });
      source.onopen = () => {
        void refresh(true);
      };
      source.onerror = () => setSyncState('offline');
    };
    connect();
    const onFocus = () => {
      void refresh(true);
      void refreshHost();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(() => {
      if (Date.now() - lastUpdated.current > 22000) void refresh(true);
      void refreshHost();
    }, 25000);
    return () => {
      source?.close();
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, refreshHost, refreshExtendedSystem]);

  const submitLogin = async () => {
    try {
      await api.login(loginToken);
      setLoginToken('');
      setNeedsLogin(false);
      await refresh();
      await refreshHost();
      await refreshExtendedSystem();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zalogować');
    }
  };

  const activeSession = snapshot?.sessions.find((s) => s.id === sessionId);
  const messages = useMemo(
    () => (snapshot?.messages || []).filter((m) => m.sessionId === sessionId),
    [snapshot, sessionId],
  );

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sessionId]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value || busy || !sessionId) return;
    setBusy(true);
    setError('');
    setText('');
    try {
      await api.sendMessage(sessionId, value, recipient);
      await refresh(true);
      await refreshHost();
    } catch (e) {
      if (!(e instanceof ApiFailure && e.code === 503)) setText(value);
      setError(e instanceof Error ? e.message : 'Nie udało się wysłać');
      await refresh(true);
    } finally {
      setBusy(false);
      textbox.current?.focus();
    }
  };

  const startSession = async () => {
    try {
      const s = await api.createSession();
      await refresh(true);
      setSessionId(s.id);
      setDrawer(false);
      setPanel('none');
      setText('');
    } catch (e) {
      setError(String(e));
    }
  };

  const archiveSession = async (s: Session) => {
    try {
      await api.archiveSession(s.id);
      await refresh(true);
    } catch (e) {
      setError(String(e));
    }
  };

  const loadAvatar = async () => {
    try {
      await api.updateAvatar(avatarEdit, avatarValue.trim());
      await refresh(true);
      setError('');
    } catch (e) {
      setError(String(e));
    }
  };

  const onAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 390000) {
      setError('Awatar musi być obrazem PNG/JPEG/WEBP/GIF do 390 KB.');
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(Error('Nie można odczytać pliku.'));
        reader.readAsDataURL(file);
      });
      await api.updateAvatar(avatarEdit, dataUrl);
      setAvatarValue(dataUrl);
      await refresh(true);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać awatara.');
    }
  };

  const onAttachFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Załącznik nie może przekraczać 2 MB.');
      return;
    }
    try {
      if (file.type.startsWith('text/') || /\.(json|md|ts|tsx|js|py|sh|log|csv|yaml|yml)$/i.test(file.name)) {
        const content = await file.text();
        setText((prev) => `${prev ? prev + '\n\n' : ''}[Załącznik: ${file.name}]\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\``);
      } else {
        setText((prev) => `${prev ? prev + '\n' : ''}[Załączono plik: ${file.name} (${Math.round(file.size / 1024)} KB, ${file.type || 'binary'})]`);
      }
      textbox.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się odczytać załącznika.');
    }
  };

  const executeQuantumKernel = async () => {
    try {
      const res = await api.runQuantumWheel();
      setQuantumReport(res.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd wykonania jądra Python');
    }
  };

  const executeHyperConsole = async () => {
    if (!hyperCmd.trim()) return;
    try {
      const res = await api.runHyperOs(hyperCmd.trim());
      setHyperOut(res.output);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd konsoli 128-bit');
    }
  };

  const executeNlPlanner = async () => {
    if (!nlInput.trim()) return;
    try {
      const res = await api.runNlPlan(nlInput.trim());
      setNlPlan(res.plannedCommands || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd planera komend');
    }
  };

  const handleSaveMemory = async () => {
    if (!memoryInput.trim()) return;
    try {
      await api.saveMemory(memoryInput.trim(), 'global', 'fact');
      setMemoryInput('');
      await refreshExtendedSystem();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać pamięci');
    }
  };

  const handleGitSync = async (action: 'status' | 'commit-push') => {
    try {
      const res = await api.githubSync(action);
      setGitState(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd synchronizacji GitHub');
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as Element).closest('input,textarea,button,select')) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const p = touchStart.current;
    touchStart.current = null;
    if (!p || window.innerWidth > 740) return;
    const dx = e.changedTouches[0].clientX - p.x;
    const dy = e.changedTouches[0].clientY - p.y;
    if (Math.abs(dx) < 95 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0) setDrawer(true);
    else if (drawer) setDrawer(false);
    else setPanel('system');
  };

  const health = snapshot?.health;
  const openCodeStatus = health?.opencode;
  const copyLoginCommand = () => {
    void navigator.clipboard?.writeText('opencode auth login openai');
  };
  const panelTitle = {
    none: '',
    system: 'System Linux',
    agents: 'Agenci AI',
    library: 'Biblioteka UI',
    settings: 'Wygląd i avatary',
  }[panel];
  const preview = BLOCK_DEMOS[libraryType] || BLOCK_DEMOS.card;
  const filteredLibrary = Object.entries(UI_GROUPS)
    .map(([category, types]) => ({
      category,
      types: types.filter((t) => t.toLowerCase().includes(librarySearch.trim().toLowerCase())),
    }))
    .filter((g) => g.types.length);

  const visibleSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    return (snapshot?.sessions || [])
      .filter((s) => (viewArchive ? s.archived : !s.archived))
      .filter((s) => !q || s.title.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [snapshot?.sessions, viewArchive, sessionSearch]);

  return (
    <div className="shell" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {drawer && <button className="mobile-shade" aria-label="Zamknij historię" onClick={() => setDrawer(false)} />}
      <aside className={'sidebar ' + (drawer ? 'sidebar-open' : '')}>
        <div className="brand">
          <div className="brand-icon">
            <Layers3 size={21} />
          </div>
          <div>
            <strong>
              BASTILLA <em>OS</em>
            </strong>
            <span>SVL System · OpenCode ChatGPT</span>
          </div>
          <button className="icon-button close-drawer" onClick={() => setDrawer(false)}>
            <X size={18} />
          </button>
        </div>
        <button className="new-chat" onClick={() => void startSession()}>
          <MessageCirclePlus size={18} /> Nowy czat <span>＋</span>
        </button>
        <div className="library-search" style={{ margin: '0 10px 6px' }}>
          <Search size={14} />
          <input
            placeholder="Szukaj rozmowy…"
            aria-label="Szukaj rozmowy"
            value={sessionSearch}
            onChange={(e) => setSessionSearch(e.target.value)}
          />
        </div>
        <div className="sidebar-section">
          <span>ROZMOWY</span>
          <button onClick={() => setViewArchive((x) => !x)} aria-label="Archiwum">
            <Archive size={15} />
          </button>
        </div>
        <nav className="conversation-list" aria-label="Historia rozmów">
          {visibleSessions.map((s) => (
            <div className={'session ' + (s.id === sessionId ? 'active' : '')} key={s.id}>
              <button
                title={s.title}
                className="session-main"
                onClick={() => {
                  setSessionId(s.id);
                  setDrawer(false);
                }}
              >
                <History size={16} />
                <span>{s.title}</span>
              </button>
              {!s.archived && (
                <button title="Archiwizuj" className="session-archive" onClick={() => void archiveSession(s)}>
                  <Archive size={14} />
                </button>
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            onClick={() => {
              setPanel('library');
              setDrawer(false);
            }}
          >
            <BookOpen size={17} /> Biblioteka elementów <small>{UI_TYPES.length}</small>
          </button>
          <button
            onClick={() => {
              setPanel('system');
              setDrawer(false);
              void refreshExtendedSystem();
            }}
          >
            <Server size={17} /> Linux i synchronizacja
          </button>
          <button
            onClick={() => {
              setPanel('agents');
              setDrawer(false);
            }}
          >
            <Activity size={17} /> Agenci AI
          </button>
          <button
            onClick={() => {
              setPanel('settings');
              setDrawer(false);
            }}
          >
            <Settings size={17} /> Personalizacja
          </button>
        </div>
        <div className="sidebar-footer">
          <div className="user-dot">
            <InitialAvatar name="Operator" avatar={snapshot?.avatars?.Operator} size={33} />
            <div>
              <strong>Operator</strong>
              <span>Własny interfejs</span>
            </div>
          </div>
          <span className="build-tag">LOCAL-FIRST</span>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="top-left">
            <button className="icon-button sidebar-toggle" aria-label="Otwórz historię" onClick={() => setDrawer(!drawer)}>
              <Menu size={21} />
            </button>
            <div className="page-title">
              <strong>BASTILLA OS</strong>
              <span>{activeSession?.title || 'Enter hyperspace'}</span>
            </div>
            <ChevronDown size={14} className="subtle" />
          </div>
          <div className="top-actions">
            <span className={'sync-badge ' + syncState}>
              <StatusDot online={syncState === 'online'} />
              {syncState === 'online' ? 'Synchronizacja aktywna' : syncState === 'connecting' ? 'Łączenie…' : 'Brak połączenia'}
            </span>
            <button
              className="icon-button"
              aria-label="Synchronizuj"
              title="Synchronizuj ze wspólnym stanem"
              onClick={() => {
                void refresh();
                void refreshHost();
                void refreshExtendedSystem();
              }}
            >
              <RefreshCcw size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Panel systemowy"
              title="Centrum systemowe"
              onClick={() => {
                const next = panel === 'system' ? 'none' : 'system';
                setPanel(next);
                if (next === 'system') void refreshExtendedSystem();
              }}
            >
              <Activity size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="Biblioteka"
              title="Biblioteka elementów"
              onClick={() => setPanel(panel === 'library' ? 'none' : 'library')}
            >
              <Layers3 size={19} />
            </button>
          </div>
        </header>
        {error && (
          <div role="alert" className="error-banner">
            <AlertTriangle size={16} />
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Zamknij">
              <X size={16} />
            </button>
          </div>
        )}
        {needsLogin && (
          <div className="login-backdrop">
            <form
              className="login-dialog"
              onSubmit={(e) => {
                e.preventDefault();
                void submitLogin();
              }}
            >
              <div className="hero-symbol">
                <ShieldCheck size={34} />
              </div>
              <h2>Dostęp operatora</h2>
              <p>Podaj SVL_OPERATOR_TOKEN skonfigurowany na serwerze. Token nie jest zapisywany w przeglądarce.</p>
              <input
                aria-label="Token operatora"
                type="password"
                autoComplete="off"
                value={loginToken}
                onChange={(e) => setLoginToken(e.target.value)}
                placeholder="Token operatora"
              />
              <button type="submit" disabled={!loginToken}>
                Połącz
              </button>
            </form>
          </div>
        )}
        <div className="chat-scroll" ref={viewport}>
          <div className="chat-inner">
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="hero-symbol">
                  <Layers3 size={44} />
                </div>
                <div className="eyebrow">BASTILLA OS / SVL SYSTEM</div>
                <h1>
                  Enter <span>hyperspace.</span>
                </h1>
                <p>
                  Jeden czat, własny design i ChatGPT przez OpenCode na Debianie 13. Statusy pochodzą wyłącznie z działających
                  usług.
                </p>
                <div className="suggestions">
                  {welcome.map((line, i) => (
                    <button
                      key={line}
                      onClick={() =>
                        i === 2 ? setPanel('library') : i === 3 || i === 1 ? setPanel('system') : setText(line)
                      }
                    >
                      <span>
                        {i === 0 ? (
                          <Sparkles size={19} />
                        ) : i === 1 ? (
                          <Activity size={19} />
                        ) : i === 2 ? (
                          <Layers3 size={19} />
                        ) : (
                          <Cpu size={19} />
                        )}
                      </span>
                      {line}
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div className={'message-row ' + (m.role === 'user' ? 'user-message' : '')} key={m.id}>
                  <InitialAvatar
                    name={m.author.startsWith('Operator') ? 'Operator' : m.author}
                    avatar={snapshot?.avatars?.[m.author]}
                    size={36}
                  />
                  <div className="message-body">
                    <div className="message-meta">
                      <strong>{m.author}</strong>
                      <span>{humanTime(m.createdAt)}</span>
                      {m.provider && <small>{m.provider}</small>}
                      {m.status === 'failed' && <span className="failure">Błąd</span>}
                    </div>
                    <RichContent
                      content={m.content}
                      onDraft={(s) => {
                        setText(s);
                        textbox.current?.focus();
                      }}
                    />
                    <button
                      className="copy-message"
                      aria-label="Kopiuj wiadomość"
                      onClick={() => navigator.clipboard?.writeText(m.content)}
                    >
                      <Clipboard size={13} /> Kopiuj
                    </button>
                  </div>
                </div>
              ))
            )}
            <div ref={bottom} />
          </div>
        </div>
        <footer className="composer-shell">
          <form className="composer" onSubmit={(e) => void submit(e)}>
            <div className="recipient-row">
              <span>
                <Signal size={14} /> Odbiorca:
              </span>
              <select
                aria-label="Odbiorca wiadomości"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value as typeof recipient)}
              >
                <option value="Wszyscy">Wszyscy · OpenCode / Ollama</option>
                {AGENTS.map((a) => (
                  <option value={a} key={a}>
                    {a} · kolejka agenta
                  </option>
                ))}
              </select>
              <span className="footer-real">
                {openCodeStatus?.openaiConnected
                  ? 'OpenCode · OpenAI dostępne'
                  : health?.ollama.reachable
                    ? 'Ollama · ' + (health.ollama.model || 'dostępna')
                    : openCodeStatus?.reachable
                      ? 'OpenCode · wymagane logowanie'
                      : 'Silniki AI · oczekiwanie na hosta'}
              </span>
            </div>
            <textarea
              ref={textbox}
              rows={2}
              value={text}
              placeholder="Napisz do Bastilla OS…"
              aria-label="Wiadomość"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <div className="compose-actions">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => void onAttachFile(e)}
                />
                <button
                  type="button"
                  title="Dodaj plik lub obraz"
                  aria-label="Dodaj plik lub obraz"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={18} />
                </button>
                <button type="button" title="Biblioteka elementów" onClick={() => setPanel('library')}>
                  <Layers3 size={18} />
                </button>
                <button type="button" title="Stan hosta Linux i terminale" onClick={() => setPanel('system')}>
                  <Terminal size={18} />
                </button>
                <span className="small-caption">Shift + Enter — nowy wiersz</span>
              </div>
              <button className="send-button" type="submit" disabled={!text.trim() || busy || !sessionId}>
                {busy ? 'Wysyłanie…' : <Send size={18} />}
              </button>
            </div>
          </form>
          <div className="disclaimer">
            Bastilla OS · ChatGPT przez OpenCode na hoście · globalny stan jednej instancji · Linux przez uwierzytelniony
            observer
          </div>
        </footer>
      </main>
      {panel !== 'none' && (
        <>
          <button className="panel-shade" aria-label="Zamknij panel" onClick={() => setPanel('none')} />
          <aside className="detail-panel">
            <div className="detail-head">
              <div>
                <small>CENTRUM STEROWANIA</small>
                <h2>{panelTitle}</h2>
              </div>
              <button className="icon-button" aria-label="Zamknij panel" onClick={() => setPanel('none')}>
                <X size={19} />
              </button>
            </div>
            <div className="detail-content">
              {panel === 'system' && (
                <>
                  <div className="detail-card">
                    <div className="info-title">
                      <Server size={17} /> Global Sync <StatusDot online={syncState === 'online'} />
                    </div>
                    <p>Dane czatu i pamięci synchronizują się przez wspólny backend. Linux wymaga aktywnej usługi na hoście.</p>
                    <div className="metric-grid">
                      <div>
                        <small>Stan GUI</small>
                        <strong>{syncState === 'online' ? 'ONLINE' : 'OFFLINE'}</strong>
                      </div>
                      <div>
                        <small>Host Linux</small>
                        <strong>{hostSnapshot?.connected ? 'POŁĄCZONY' : 'BRAK'}</strong>
                      </div>
                    </div>
                    <button
                      className="subtle-button"
                      onClick={() => {
                        void refresh();
                        void refreshHost();
                        void refreshExtendedSystem();
                      }}
                    >
                      <RefreshCcw size={15} /> Synchronizuj wszystko
                    </button>
                  </div>

                  <div className="detail-card">
                    <div className="info-title">
                      <HardDrive size={17} /> Host Debian / Linux
                    </div>
                    {hostSnapshot?.connected ? (
                      <>
                        <div className="metric-grid">
                          <div>
                            <small>Nazwa hosta</small>
                            <strong>{hostSnapshot.host?.hostname || '—'}</strong>
                          </div>
                          <div>
                            <small>System</small>
                            <strong>{hostSnapshot.host?.os || 'Linux'}</strong>
                          </div>
                          <div>
                            <small>RAM</small>
                            <strong>{hostSnapshot.host?.memoryPercent ?? '—'}%</strong>
                          </div>
                          <div>
                            <small>Usługi</small>
                            <strong>{hostSnapshot.host?.services?.length ?? 0}</strong>
                          </div>
                        </div>
                        <p>
                          Ostatni pomiar: {humanTime(hostSnapshot.receivedAt)}.{' '}
                          {hostSnapshot.host?.scope === 'app-container'
                            ? 'To dane kontenera aplikacji, a nie hosta Debian.'
                            : 'Dane z uwierzytelnionego obserwatora hosta Linux.'}
                        </p>
                        <div className="metric-grid">
                          <div>
                            <small>Procesy Linux</small>
                            <strong>{hostSnapshot.host?.processCount ?? '—'}</strong>
                          </div>
                          <div>
                            <small>Dysk systemowy</small>
                            <strong>{hostSnapshot.host?.diskPercent ?? '—'}%</strong>
                          </div>
                        </div>
                        <p>
                          Ollama na hoście:{' '}
                          <strong>{hostSnapshot.host?.ollama?.reachable ? 'ODPOWIADA' : 'BRAK POŁĄCZENIA'}</strong>
                        </p>
                        {hostSnapshot.host?.ollama?.models?.length > 0 && (
                          <p>Modele: {hostSnapshot.host.ollama.models.join(', ')}</p>
                        )}
                        <label>
                          Wyszukaj usługę systemd
                          <input
                            value={serviceFilter}
                            onChange={(e) => setServiceFilter(e.target.value)}
                            placeholder="np. ollama.service"
                          />
                        </label>
                        <div className="host-services">
                          {(hostSnapshot.host?.services || [])
                            .filter((service: { name: string }) =>
                              service.name.toLowerCase().includes(serviceFilter.toLowerCase()),
                            )
                            .slice(0, 80)
                            .map((service: { name: string; state: string }) => (
                              <div className="host-service" key={service.name}>
                                <span>{service.name}</span>
                                <small>{service.state}</small>
                              </div>
                            ))}
                        </div>
                      </>
                    ) : (
                      <p>
                        Host Linux offline / brak potwierdzenia UID 0. Włącz usługę linux-observer na docelowym Debianie 13.
                      </p>
                    )}
                  </div>

                  <div className="detail-card">
                    <div className="info-title">
                      <Terminal size={17} /> Terminale Systemowe (A–E)
                    </div>
                    {terminalsList.map((t) => (
                      <p key={t.id}>
                        <strong>{t.name}:</strong> {t.status.toUpperCase()} — <small>{t.details}</small>
                      </p>
                    ))}
                    <button className="subtle-button" onClick={() => void executeQuantumKernel()}>
                      <Cpu size={15} /> Uruchom Python Kernel (5.6.0-QuantumWheel)
                    </button>
                    {quantumReport && (
                      <pre style={{ fontSize: 11, overflowX: 'auto', marginTop: 8 }}>
                        {JSON.stringify(quantumReport, null, 2)}
                      </pre>
                    )}
                    <label style={{ marginTop: 8, display: 'block' }}>
                      Terminal 128-bit Hiperprzestrzeni
                      <input
                        value={hyperCmd}
                        onChange={(e) => setHyperCmd(e.target.value)}
                        placeholder="STATUS, ALLOC, PARALLEL_EXEC…"
                      />
                    </label>
                    <button className="subtle-button" onClick={() => void executeHyperConsole()}>
                      Wykonaj 128-bit
                    </button>
                    {hyperOut && <pre style={{ fontSize: 11, overflowX: 'auto', marginTop: 6 }}>{hyperOut}</pre>}
                    <label style={{ marginTop: 8, display: 'block' }}>
                      Terminal Języka Naturalnego (Plan komend Linux)
                      <input
                        value={nlInput}
                        onChange={(e) => setNlInput(e.target.value)}
                        placeholder="np. sprawdź pamięć RAM i dysk"
                      />
                    </label>
                    <button className="subtle-button" onClick={() => void executeNlPlanner()}>
                      Generuj plan komend
                    </button>
                    {nlPlan.length > 0 && (
                      <pre style={{ fontSize: 11, overflowX: 'auto', marginTop: 6 }}>{nlPlan.join('\n')}</pre>
                    )}
                  </div>

                  <div className="detail-card">
                    <div className="info-title">
                      <Cpu size={17} /> OpenCode · konto ChatGPT
                    </div>
                    <p>
                      Status serwera: <strong>{openCodeStatus?.reachable ? 'OSIĄGALNY' : 'OFFLINE'}</strong>
                    </p>
                    <p>
                      OpenAI: <strong>{openCodeStatus?.openaiConnected ? 'PODŁĄCZONE' : 'NIEPODŁĄCZONE'}</strong>
                    </p>
                    <p>
                      Model OpenAI: <strong>{openCodeStatus?.defaultOpenAiModel || 'nie wybrano'}</strong>
                    </p>
                    <p>{openCodeStatus?.message || 'Oczekiwanie na status OpenCode…'}</p>
                    <button className="subtle-button" onClick={copyLoginCommand}>
                      <Clipboard size={15} /> Kopiuj: opencode auth login openai
                    </button>
                  </div>

                  <div className="detail-card">
                    <div className="info-title">
                      <Cpu size={17} /> Ollama i modele
                    </div>
                    <p>
                      Połączenie: <strong>{health?.ollama.reachable ? 'OK' : 'NIEDOSTĘPNE'}</strong>
                    </p>
                    <p>
                      Model: <strong>{health?.ollama.model || 'brak potwierdzenia'}</strong>
                    </p>
                    {!health?.ollama.reachable && (
                      <p>
                        Krok na hoście Debian 13: <code>OLLAMA_HOST=127.0.0.1:11434 ollama serve</code>
                      </p>
                    )}
                  </div>

                  <div className="detail-card">
                    <div className="info-title">
                      <Server size={17} /> Synchronizacja GitHub (gałąź main)
                    </div>
                    <p>
                      Status: <strong>{gitState?.status || 'sprawdzanie'}</strong> · SHA:{' '}
                      <code>{(gitState?.localCommit || gitState?.latestCommit || 'brak').slice(0, 12)}</code>
                    </p>
                    <button className="subtle-button" onClick={() => void handleGitSync('status')}>
                      <RefreshCcw size={15} /> Sprawdź status main
                    </button>
                  </div>

                  <div className="detail-card">
                    <div className="info-title">
                      <HardDrive size={17} /> Pamięć Długoterminowa ({memoryList.length})
                    </div>
                    <label>
                      Dodaj wpis pamięci systemowej
                      <input
                        value={memoryInput}
                        onChange={(e) => setMemoryInput(e.target.value)}
                        placeholder="Zapisz fakt lub decyzję…"
                      />
                    </label>
                    <button className="subtle-button" onClick={() => void handleSaveMemory()}>
                      Zapisz w pamięci
                    </button>
                    {memoryList.slice(0, 4).map((m) => (
                      <p key={m.id} style={{ fontSize: 12 }}>
                        <code>[{m.scope}]</code> {m.text}
                      </p>
                    ))}
                  </div>

                  <div className="detail-card">
                    <div className="info-title">
                      <Layers3 size={17} /> Moduły Hyperspace ({appsCatalog.length}) & MCP ({mcpCatalog.length})
                    </div>
                    <p>Zainstalowane moduły w /apps: {appsCatalog.map((a) => a.name).join(', ') || 'brak'}</p>
                    <p>Narzędzia MCP: {mcpCatalog.map((t) => t.name).join(', ') || 'brak'}</p>
                  </div>

                  <div className="detail-card">
                    <div className="info-title">
                      <ShieldCheck size={17} /> Uprawnienia i zakres
                    </div>
                    <p>
                      Interfejs nie wykonuje poleceń root automatycznie. Status systemd/UID pochodzi z połączonego hosta i nie
                      jest wytwarzany przez model.
                    </p>
                  </div>
                </>
              )}
              {panel === 'agents' && (
                <>
                  <p className="panel-intro">
                    Cztery niezależne tożsamości. Status ONLINE wymaga prawdziwego heartbeat, nie wpisu w konfiguracji.
                  </p>
                  {AGENTS.map((a) => {
                    const agent = health?.agents.find((x) => x.name === a);
                    const detail = agentsDetail.find((x) => x.name === a);
                    return (
                      <div className="agent-card" key={a}>
                        <InitialAvatar name={a} avatar={snapshot?.avatars?.[a]} size={40} />
                        <div>
                          <strong>{a}</strong>
                          <p>
                            {detail?.statusLabel ||
                              (agent?.connected
                                ? agent.modelReady
                                  ? 'Model dostępny · ' + (agent.model || 'gotowa')
                                  : 'Worker uruchomiony, model niedostępny'
                                : 'Offline')}
                          </p>
                          <small>
                            Heartbeat: {humanTime(agent?.lastSeen)}
                            {detail?.queue
                              ? ` · Kolejka: oczekuje ${detail.queue.queued}, w toku ${detail.queue.running}, wykonane ${detail.queue.completed}`
                              : ''}
                            {agent?.error ? ' · ' + agent.error : ''}
                          </small>
                        </div>
                        <StatusDot online={Boolean(agent?.connected && agent?.modelReady)} />
                      </div>
                    );
                  })}
                  <div className="detail-card">
                    <p>
                      Wiadomości do agenta trafiają do kolejki. Agent odpowie dopiero po uwierzytelnionym odebraniu i wykonaniu
                      zadania.
                    </p>
                  </div>
                </>
              )}
              {panel === 'library' && (
                <>
                  <p className="panel-intro">
                    {UI_TYPES.length} interaktywnych elementów w {Object.keys(UI_GROUPS).length} kategoriach. Podglądy są
                    przykładami, nie wynikami systemu.
                  </p>
                  <div className="library-search">
                    <Search size={16} />
                    <input
                      placeholder="Wyszukaj typ elementu…"
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                    />
                  </div>
                  {filteredLibrary.map((g) => (
                    <div className="lib-group" key={g.category}>
                      <h3>
                        {g.category} <small>{g.types.length}</small>
                      </h3>
                      <div className="lib-chips">
                        {g.types.map((t) => (
                          <button key={t} className={libraryType === t ? 'selected' : ''} onClick={() => setLibraryType(t)}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="preview-area">
                    <h3>Podgląd · {libraryType}</h3>
                    <RichBlock block={preview} />
                    <button
                      className="subtle-button"
                      onClick={() => {
                        setText('Pokaż element ' + libraryType + ' jako interaktywny blok svl-ui.');
                        setPanel('none');
                      }}
                    >
                      Użyj w czacie
                    </button>
                  </div>
                </>
              )}
              {panel === 'settings' && (
                <>
                  <p className="panel-intro">
                    Ustaw awatary własne i agentów. Adres HTTPS zostanie zsynchronizowany na wszystkich urządzeniach.
                  </p>
                  <div className="detail-card">
                    <label>
                      Profil
                      <select
                        value={avatarEdit}
                        onChange={(e) => {
                          setAvatarEdit(e.target.value);
                          setAvatarValue(snapshot?.avatars?.[e.target.value] || '');
                        }}
                      >
                        {['Operator', ...AGENTS].map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Wgraj własny obraz (do 390 KB)
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => void onAvatarFile(e)}
                      />
                    </label>
                    <label>
                      URL HTTPS awatara
                      <input value={avatarValue} placeholder="https://…" onChange={(e) => setAvatarValue(e.target.value)} />
                    </label>
                    <button className="subtle-button" onClick={() => void loadAvatar()}>
                      <CheckCircle2 size={15} /> Zapisz i synchronizuj
                    </button>
                  </div>
                  <div className="detail-card">
                    <p>
                      Generowanie awatara z promptu wymaga podłączonego i działającego API generatora obrazów. Ten interfejs
                      nie pokazuje fikcyjnego renderowania.
                    </p>
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

export default App;
