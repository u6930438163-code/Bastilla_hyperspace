import React, { useEffect, useRef, useState } from 'react';
import { DataStore, OPERATOR_NAME } from '../kernel/svlKernel';
import { SYSTEM_AGENTS, AgentProfile } from '../kernel/agents';
import {
  Sparkles,
  Layers,
  ShieldCheck,
  RefreshCw,
  Image as ImageIcon,
  FileText,
  Paperclip,
  Send,
  X,
  Maximize2,
  Minimize2,
  Rocket,
  Sliders,
  Github,
  Bot,
  ExternalLink,
} from 'lucide-react';
import { FormattedMessage } from './FormattedMessage';
import { InteractiveChatToolbar } from './InteractiveChatToolbar';
import {
  ASTYRIA_MISSION_ACTIONS,
  ASTYRIA_MISSION_LABELS,
  AGENT_PROTOCOL_COMMANDS,
  AGENT_PROTOCOL_LABELS,
  AstyriaMissionAction,
  AgentProtocolCommand,
  AgentProtocolReply,
  AgentProtocolRequest,
} from '../kernel/agentProtocol';
import {
  CHAT_ATTACHMENT_ACCEPT,
  ChatAttachment,
  MAX_CHAT_ATTACHMENTS,
  readChatAttachmentFile,
  validateChatAttachments,
} from '../kernel/chatAttachments';
import { normalizeFleetState } from '../kernel/fleetAndUiState';
import { TabId } from './Navigation';

interface AgentCommsViewProps {
  dataStore: DataStore;
  onSendProtocol: (request: AgentProtocolRequest) => Promise<AgentProtocolReply | undefined>;
  onSendMessage: (
    message: string,
    agent: 'triad' | 'Alex' | 'Astyria' | 'Aurelius' | 'Aria',
    attachments?: ChatAttachment[],
  ) => Promise<void>;
  onRunAstyriaMission: (action: AstyriaMissionAction) => Promise<void>;
  isLoading: boolean;
  sendError?: string | null;
  onClearHistory: () => void;
  onForceSync?: () => void;
  onTriggerInitiative?: () => Promise<void>;
  onUnclog?: () => void;
  onRestoreBackup?: () => void;
  onNavigateTab?: (tab: TabId) => void;
}

export const AgentCommsView: React.FC<AgentCommsViewProps> = ({
  dataStore,
  onSendProtocol,
  onSendMessage,
  onRunAstyriaMission,
  isLoading,
  sendError,
  onClearHistory,
  onForceSync,
  onTriggerInitiative,
  onNavigateTab,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<
    'triad' | 'Alex' | 'Astyria' | 'Aurelius' | 'Aria'
  >('triad');
  const [selectedCommand, setSelectedCommand] = useState<AgentProtocolCommand>('SYSTEM_STATUS');
  const [selectedMissionAction, setSelectedMissionAction] =
    useState<AstyriaMissionAction>('deep_scan');
  const [messageText, setMessageText] = useState('');
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [showProtocolDrawer, setShowProtocolDrawer] = useState(false);
  const [showRichToolbar, setShowRichToolbar] = useState(false);
  const [showAgentsSidebar, setShowAgentsSidebar] = useState(false);
  const [isMaximizedChat, setIsMaximizedChat] = useState(false);
  const [autoDialogueEnabled, setAutoDialogueEnabled] = useState(false);
  const [runningMasterMission, setRunningMasterMission] = useState(false);
  const [editingAvatarKey, setEditingAvatarKey] = useState<string | null>(null);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const DEFAULT_AVATARS: Record<string, string> = {
    Alex: '/api/pollinations/image?prompt=futuristic%20male%20AI%20commander%20portrait%20cyberpunk%20emerald%20green%20lighting%20high%20tech%20visage%20bastilla%20os&width=512&height=512&model=flux',
    Astyria: '/api/pollinations/image?prompt=ethereal%20female%20AI%20botanist%20portrait%20nature%20tech%20hybrid%20cyan%20blue%20neon%20bioluminescent%20plants%20bastilla%20os&width=512&height=512&model=flux',
    Aria: '/api/pollinations/image?prompt=mysterious%20AI%20entity%20abstract%20face%20data%20streams%20amber%20gold%20glow%20telemetry%20visualizer%20bastilla%20os&width=512&height=512&model=flux',
    Aurelius: '/api/pollinations/image?prompt=stoic%20AI%20guardian%20heavy%20cybernetic%20armor%20purple%20indigo%20accents%20monolith%20background%20bastilla%20os&width=512&height=512&model=flux',
    Operator: 'https://api.dicebear.com/9.x/identicon/svg?seed=MateuszMitek&backgroundColor=581c87',
  };

  const [customAvatars, setCustomAvatars] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('svl_custom_avatars_v1');
      if (saved) return { ...DEFAULT_AVATARS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_AVATARS;
  });

  const saveAvatarForKey = (key: string, url: string) => {
    const next = { ...customAvatars, [key]: url };
    setCustomAvatars(next);
    try {
      localStorage.setItem('svl_custom_avatars_v1', JSON.stringify(next));
    } catch {}
    setEditingAvatarKey(null);
    setAvatarUrlInput('');
  };

  const handleRunMasterMission = async () => {
    if (runningMasterMission) return;
    setRunningMasterMission(true);
    try {
      const res = await fetch('/api/triad/master-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        if (onForceSync) onForceSync();
        window.dispatchEvent(new CustomEvent('svl-global-sync'));
      }
    } catch {} finally {
      setRunningMasterMission(false);
    }
  };

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const followLatestMessagesRef = useRef(true);
  const fleetState = normalizeFleetState(dataStore.config?.fleet_state);

  const transmissionStatus = sendError
    ? { label: 'BŁĄD TRANSMISJI', color: 'rose' }
    : isLoading
    ? { label: 'PRZETWARZANIE', color: 'cyan' }
    : { label: 'GOTOWY', color: 'slate' };

  useEffect(() => {
    const chatScroll = chatScrollRef.current;
    if (chatScroll && followLatestMessagesRef.current) {
      chatScroll.scrollTop = chatScroll.scrollHeight;
    }
  }, [dataStore.chat_history.length, isLoading]);

  useEffect(() => {
    if (!autoDialogueEnabled || !onTriggerInitiative) return;
    const timer = window.setInterval(() => {
      if (!isLoading) {
        void onTriggerInitiative();
      }
    }, 28000);
    return () => window.clearInterval(timer);
  }, [autoDialogueEnabled, isLoading, onTriggerInitiative]);

  const navigateToTab = (tab: TabId) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
      return;
    }
    if (typeof (window as any).setActiveTab === 'function') {
      (window as any).setActiveTab(tab);
    }
  };

  const handleSendProtocol = async () => {
    if (isLoading) return;
    try {
      await onSendProtocol({
        command: selectedCommand,
        agent: selectedTarget,
      });
    } catch {}
  };

  const handleRunAstyriaMission = async () => {
    if (isLoading) return;
    setSelectedTarget('Astyria');
    try {
      await onRunAstyriaMission(selectedMissionAction);
    } catch {}
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = messageText.startsWith('/propose write-file ')
      ? messageText
      : messageText.trim();
    if ((!message && chatAttachments.length === 0) || isLoading) return;
    try {
      await onSendMessage(message, selectedTarget, chatAttachments);
      setMessageText('');
      setChatAttachments([]);
      setAttachmentError(null);
    } catch {}
  };

  const handleAttachmentSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setAttachmentError(null);
    if (files.length === 0) return;
    if (chatAttachments.length + files.length > MAX_CHAT_ATTACHMENTS) {
      setAttachmentError(`Możesz dołączyć maksymalnie ${MAX_CHAT_ATTACHMENTS} pliki.`);
      return;
    }
    let incoming: ChatAttachment[];
    try {
      incoming = await Promise.all(files.map(readChatAttachmentFile));
    } catch (error) {
      setAttachmentError(
        error instanceof Error ? error.message : 'Nie udało się odczytać wybranego pliku.',
      );
      return;
    }
    const validation = validateChatAttachments([...chatAttachments, ...incoming]);
    if (!validation.valid) {
      setAttachmentError(validation.error);
      return;
    }
    setChatAttachments(validation.attachments);
  };

  return (
    <div
      className={`${
        isMaximizedChat ? 'fixed inset-0 z-50' : 'relative flex-1'
      } flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-950 font-mono text-xs cyber-grid lg:flex-row`}
    >
      {/* Main Column: Maximized Chat Stream */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-950/85 backdrop-blur-md">
        {/* Ultra-Compact Single-Row Control Bar (Maximizes Chat Space!) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-cyan-500/20 bg-slate-900/90 px-2.5 py-1.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              aria-label="Cel transmisji"
              value={selectedTarget}
              onChange={(event) =>
                setSelectedTarget(event.target.value as typeof selectedTarget)
              }
              disabled={isLoading}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-bold text-cyan-200 outline-none focus:border-cyan-500"
            >
              <option value="triad">Triada · Alex, Astyria, Aria, Aurelius</option>
              <option value="Alex">Alex (Infrastruktura & Układ Słoneczny)</option>
              <option value="Astyria">Astyria (Botanika & Aplikacje)</option>
              <option value="Aria">Aria (Synchronizacja & Telemetria)</option>
              <option value="Aurelius">Aurelius (Bezpieczeństwo & Chronolit)</option>
            </select>

            {/* Direct Link to the Chat-Created Fleet & Solar System Module */}
            <button
              type="button"
              onClick={() => navigateToTab('fleet')}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-950/70 px-2 py-1 text-[10px] font-bold text-emerald-200 hover:bg-emerald-900/80 cursor-pointer"
              title="Otwórz Moduł Zarządzania Flotą (Mapa Układu Słonecznego, Botanika, Misje, Badania)"
            >
              <Rocket className="h-3 w-3 text-emerald-300" />
              <span>Flota ({fleetState.ships.length} statków)</span>
            </button>

            <a
              href="/api/apps/preview/zarzadzanie-flota/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-950/50 px-2 py-1 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-900/60"
            >
              <span>/apps/zarzadzanie-flota</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setShowRichToolbar((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition cursor-pointer ${
                showRichToolbar
                  ? 'border-cyan-400 bg-cyan-950 text-cyan-100'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="h-3 w-3 text-cyan-300" />
              <span>Widżety</span>
            </button>

            <button
              type="button"
              onClick={() => setShowProtocolDrawer((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition cursor-pointer ${
                showProtocolDrawer
                  ? 'border-cyan-400 bg-cyan-950 text-cyan-100'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              <Sliders className="h-3 w-3 text-cyan-300" />
              <span className="hidden xs:inline">Protokoły</span>
            </button>

            <button
              type="button"
              onClick={() => void handleRunMasterMission()}
              disabled={runningMasterMission || isLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-950/70 px-2 py-1 text-[10px] font-bold text-emerald-200 hover:bg-emerald-900/80 cursor-pointer disabled:opacity-40"
              title="Uruchom Misję Master (Astyria 25% → Alex 50% → Aria 75% → Aurelius 100%) i zaraportuj w czacie"
            >
              <Sparkles className="h-3 w-3 text-emerald-300" />
              <span>{runningMasterMission ? 'Misja 0→100%…' : 'Misja Master (100%)'}</span>
            </button>

            <button
              type="button"
              onClick={() => void onSendMessage('przetestuj integrację z github', selectedTarget)}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-purple-500/40 bg-purple-950/60 px-2 py-1 text-[10px] font-bold text-purple-200 hover:bg-purple-900/70 cursor-pointer disabled:opacity-40"
              title="Przetestuj integrację z GitHub na czacie"
            >
              <Github className="h-3 w-3 text-purple-300" />
              <span className="hidden md:inline">Test GitHub</span>
            </button>

            {onTriggerInitiative && (
              <button
                type="button"
                onClick={() => void onTriggerInitiative()}
                disabled={isLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-950/60 px-2 py-1 text-[10px] font-bold text-amber-200 hover:bg-amber-900/70 cursor-pointer disabled:opacity-40"
                title="Wyzwól swobodną rozmowę między agentami AI i Operatorem"
              >
                <Bot className="h-3 w-3 text-amber-300" />
                <span className="hidden sm:inline">Dialog AI</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAgentsSidebar((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition cursor-pointer ${
                showAgentsSidebar
                  ? 'border-cyan-400 bg-cyan-950 text-cyan-100'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="h-3 w-3" />
              <span className="hidden sm:inline">Agenci & Avatary</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMaximizedChat((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold text-slate-200 hover:text-white cursor-pointer"
              title={isMaximizedChat ? 'Przywróć układ' : 'Maksymalizuj czat na cały ekran'}
            >
              {isMaximizedChat ? (
                <Minimize2 className="h-3 w-3 text-cyan-300" />
              ) : (
                <Maximize2 className="h-3 w-3 text-cyan-300" />
              )}
            </button>

            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-600/50 bg-rose-950/70 px-2 py-1 text-[10px] font-bold text-rose-200 hover:bg-rose-900 cursor-pointer"
              title="Wyczyść historię czatu"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Collapsible Protocol & Mission Drawer (Hidden by Default to Maximize Chat!) */}
        {showProtocolDrawer && (
          <div className="grid gap-2 border-b border-slate-800 bg-slate-900/90 px-3 py-2 sm:grid-cols-2 shrink-0">
            <div className="flex items-end gap-1.5">
              <label className="flex flex-1 flex-col gap-0.5 text-[10px] text-slate-400">
                Polecenie strukturalne
                <select
                  aria-label="Polecenie strukturalne"
                  value={selectedCommand}
                  onChange={(event) =>
                    setSelectedCommand(event.target.value as AgentProtocolCommand)
                  }
                  disabled={isLoading}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                >
                  {AGENT_PROTOCOL_COMMANDS.map((command) => (
                    <option key={command} value={command}>
                      {AGENT_PROTOCOL_LABELS[command]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void handleSendProtocol()}
                disabled={isLoading}
                className="flex items-center gap-1 rounded border border-cyan-700 bg-cyan-950/60 px-2.5 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/70 disabled:opacity-40"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Wykonaj</span>
              </button>
            </div>

            <div className="flex items-end gap-1.5">
              <label className="flex flex-1 flex-col gap-0.5 text-[10px] text-cyan-200/80">
                Misja dla Astyrii
                <select
                  aria-label="Misja dla Astyrii"
                  value={selectedMissionAction}
                  onChange={(event) =>
                    setSelectedMissionAction(event.target.value as AstyriaMissionAction)
                  }
                  disabled={isLoading}
                  className="rounded border border-cyan-900 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                >
                  {ASTYRIA_MISSION_ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {ASTYRIA_MISSION_LABELS[action]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void handleRunAstyriaMission()}
                disabled={isLoading}
                className="flex items-center gap-1 rounded border border-cyan-700 bg-cyan-950/60 px-2.5 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-900/70 disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Wyślij misję</span>
              </button>
            </div>
          </div>
        )}

        {/* Messages Stream (Maximized Viewport + Mobile Touch Swipe Gestures) */}
        <div
          ref={chatScrollRef}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touchStartRef.current;
            const end = e.changedTouches[0];
            touchStartRef.current = null;
            if (!start || !end) return;
            const dx = end.clientX - start.x;
            const dy = end.clientY - start.y;
            if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 2) {
              if (dx < 0) {
                setShowAgentsSidebar(true);
              } else {
                setShowProtocolDrawer(true);
              }
            }
          }}
          onScroll={(event) => {
            const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
            followLatestMessagesRef.current = scrollHeight - scrollTop - clientHeight < 120;
          }}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto p-2.5 sm:p-3.5 space-y-2.5 scrollbar-thin"
        >
          {sendError && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-2.5 text-xs text-rose-200"
            >
              Nie udało się wykonać polecenia ani misji: {sendError}
            </div>
          )}

          {dataStore.chat_history.map((msg, idx) => {
            const agentKey = msg.agent === OPERATOR_NAME ? 'Operator' : msg.agent;
            const profile: AgentProfile | undefined =
              SYSTEM_AGENTS[agentKey] || SYSTEM_AGENTS[msg.agent];
            const isOperator = msg.agent === OPERATOR_NAME || msg.agent === 'Operator';
            const avatarSrc =
              customAvatars[isOperator ? 'Operator' : agentKey] ||
              DEFAULT_AVATARS[isOperator ? 'Operator' : agentKey] ||
              DEFAULT_AVATARS.Alex;

            return (
              <div
                key={idx}
                className={`flex flex-col p-3 rounded-xl border transition-all duration-200 backdrop-blur-md ${
                  isOperator
                    ? 'bg-purple-950/25 border-purple-500/40 ml-3 md:ml-10'
                    : profile
                    ? `${profile.borderColor} bg-slate-900/80 mr-3 md:mr-10`
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <img
                      src={avatarSrc}
                      alt={msg.agent}
                      className="h-5 w-5 rounded-full border border-cyan-400/40 bg-slate-950 object-cover shrink-0"
                    />
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] tracking-wide ${
                        isOperator
                          ? 'bg-purple-900/70 text-purple-200 border border-purple-500/50'
                          : profile
                          ? profile.badgeBg
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {msg.agent}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono tabular-nums">
                    SEQ #{String(idx + 1).padStart(3, '0')}
                  </span>
                </div>

                <FormattedMessage
                  content={msg.tekst}
                  className="text-xs leading-relaxed text-slate-200"
                />

                {msg.file && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60">
                    {msg.file.dataUrl && msg.file.type?.startsWith('image/') ? (
                      <div className="space-y-1">
                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          Załączony obraz: {msg.file.name}
                        </span>
                        <img
                          src={msg.file.dataUrl}
                          alt={msg.file.name}
                          className="max-h-56 rounded-md border border-slate-700 object-contain bg-black/50"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300">
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="font-semibold text-slate-200 truncate">
                          {msg.file.name}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300 p-2.5 bg-slate-900/70 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span className="text-xs">
                  Przetwarzanie transmisji i synchronizacja modułów (Alex, Astyria, Aurelius, Aria)...
                </span>
              </div>
              {onForceSync && (
                <button
                  type="button"
                  onClick={onForceSync}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-[10px] cursor-pointer"
                >
                  Odśwież stan
                </button>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Interactive Chat Widgets & Formatting Library */}
        {showRichToolbar && (
          <div className="border-t border-slate-800 bg-slate-950 px-2.5 pt-2 shrink-0">
            <InteractiveChatToolbar
              value={messageText}
              onChange={setMessageText}
              onSendDirect={(content) => void onSendMessage(content, selectedTarget)}
              disabled={isLoading}
              autoDialogueEnabled={autoDialogueEnabled}
              onToggleAutoDialogue={() => setAutoDialogueEnabled((v) => !v)}
              onTriggerAiDialogue={onTriggerInitiative}
            />
          </div>
        )}

        {/* Slim Bottom Message Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="relative w-full shrink-0 border-t border-cyan-500/20 bg-slate-950/95 px-2.5 py-2 backdrop-blur-md"
        >
          {chatAttachments.length > 0 && (
            <ul aria-label="Załączone pliki" className="mb-1.5 flex flex-wrap gap-1.5">
              {chatAttachments.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-950/40 px-2 py-0.5 text-[10px] text-cyan-100"
                >
                  <FileText className="h-3 w-3" />
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setChatAttachments((current) =>
                        current.filter((_, fileIndex) => fileIndex !== index),
                      )
                    }
                    aria-label={`Usuń załącznik ${file.name}`}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {attachmentError && (
            <p role="alert" className="mb-1 text-[10px] text-rose-300">
              {attachmentError}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <div className="relative flex min-w-0 flex-1 items-center">
              <textarea
                id="triad-chat-message"
                aria-label="Wiadomość do czatu"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if ((messageText.trim() || chatAttachments.length > 0) && !isLoading) {
                      void handleSendMessage(event as unknown as React.FormEvent<HTMLFormElement>);
                    }
                  }
                }}
                maxLength={20_500}
                rows={1}
                disabled={isLoading}
                placeholder='Wiadomość do agentów (np. "dodaj statek Helios-7 na Marsa", "zmień pasek", "test github")…'
                className="w-full resize-none rounded-lg border border-slate-700/80 bg-slate-900/90 px-3 py-2 pr-7 font-mono text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 disabled:opacity-50"
              />
              {messageText && !isLoading && (
                <button
                  type="button"
                  onClick={() => setMessageText('')}
                  className="absolute right-2 p-1 text-xs text-slate-500 hover:text-slate-300"
                  title="Wyczyść tekst"
                  aria-label="Wyczyść tekst"
                >
                  ×
                </button>
              )}
            </div>
            <label
              className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-700 text-cyan-200 hover:border-cyan-400 ${
                isLoading || chatAttachments.length >= MAX_CHAT_ATTACHMENTS
                  ? 'pointer-events-none opacity-40'
                  : ''
              }`}
              title="Dołącz pliki"
            >
              <Paperclip className="h-4 w-4" />
              <input
                type="file"
                accept={CHAT_ATTACHMENT_ACCEPT}
                multiple
                disabled={isLoading || chatAttachments.length >= MAX_CHAT_ATTACHMENTS}
                onChange={(event) => void handleAttachmentSelection(event)}
                className="sr-only"
                aria-label="Dołącz pliki tekstowe, DOCX, PDF lub JPG"
              />
            </label>
            <button
              type="submit"
              aria-label="Wyślij wiadomość do Astyrii"
              disabled={(!messageText.trim() && chatAttachments.length === 0) || isLoading}
              className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-3 font-mono text-xs font-bold text-slate-950 transition hover:from-emerald-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline text-[11px]">WYŚLIJ</span>
            </button>
          </div>
        </form>
      </div>

      {/* Collapsible Right Column: Agent Profiles & Truthful Copilot Session Status */}
      {showAgentsSidebar && (
        <div className="flex min-h-0 w-full flex-col overflow-y-auto border-t border-slate-800/80 bg-slate-950/95 p-3 space-y-3 lg:w-76 lg:border-l lg:border-t-0 shrink-0">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-cyan-500/20">
            <span className="font-bold text-slate-100 uppercase tracking-wider text-xs">
              PROFILE AGENTÓW (.github/agents)
            </span>
            <span className="text-[9px] font-mono text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">
              Copilot: offline/unverified
            </span>
          </div>

          {(['Alex', 'Astyria', 'Aurelius', 'Aria'] as const).map((agentKey) => {
            const profile = SYSTEM_AGENTS[agentKey];
            const avatarSrc = customAvatars[agentKey] || DEFAULT_AVATARS[agentKey];
            return (
              <div
                key={agentKey}
                className={`p-3 rounded-xl border ${profile.borderColor} bg-slate-900/70 space-y-1.5`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={avatarSrc}
                      alt={profile.name}
                      className="h-7 w-7 rounded-full border border-cyan-400/40 bg-slate-950 object-cover"
                    />
                    <span className={`font-bold ${profile.textColor} text-xs`}>
                      {profile.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAvatarKey(editingAvatarKey === agentKey ? null : agentKey);
                      setAvatarUrlInput(avatarSrc);
                    }}
                    className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[9px] text-cyan-300 hover:border-cyan-400 cursor-pointer"
                  >
                    Zmień avatar
                  </button>
                </div>
                {editingAvatarKey === agentKey && (
                  <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <input
                      type="text"
                      value={avatarUrlInput}
                      onChange={(e) => setAvatarUrlInput(e.target.value)}
                      placeholder="URL obrazu lub prompt AI..."
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-100"
                    />
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => saveAvatarForKey(agentKey, avatarUrlInput.trim() || DEFAULT_AVATARS[agentKey])}
                        className="rounded bg-emerald-600 px-2 py-0.5 text-[9px] font-bold text-slate-950 cursor-pointer"
                      >
                        Zapisz URL
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          saveAvatarForKey(
                            agentKey,
                            `/api/pollinations/image?prompt=${encodeURIComponent(
                              `cyberpunk futuristic AI agent avatar ${agentKey} BastillaOS purple cyan neon portrait`,
                            )}`,
                          )
                        }
                        className="rounded bg-purple-700 px-2 py-0.5 text-[9px] font-bold text-white cursor-pointer"
                      >
                        Generuj AI
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                  <span>Profil:</span>
                  <span>.github/agents/{agentKey}.agent.md</span>
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                  <span>Sesja Copilot:</span>
                  <span className="text-amber-300">offline/unverified</span>
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                  <span>Kanał czatu AI Studio:</span>
                  <span className="text-emerald-300">{transmissionStatus.label}</span>
                </div>
              </div>
            );
          })}

          <div className="p-3 rounded-xl border border-purple-500/40 bg-purple-950/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={customAvatars.Operator || DEFAULT_AVATARS.Operator}
                  alt={OPERATOR_NAME}
                  className="h-7 w-7 rounded-full border border-purple-400/50 bg-slate-950 object-cover"
                />
                <span className="font-bold text-purple-200 text-xs">{OPERATOR_NAME}</span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 font-bold font-mono">
                TATA / TWÓRCA
              </span>
            </div>
            <p className="text-[10px] text-slate-300">
              Naczelny dysponent systemu i Architekt Ring-0.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
