import React, { useState } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Code,
  FileCode,
  Sigma,
  Table as TableIcon,
  CheckSquare,
  Info,
  AlertTriangle,
  ChevronDown,
  Layers,
  Eye,
  EyeOff,
  Sparkles,
  Radio,
  MessageSquarePlus,
  Calculator,
  Cpu,
  Sliders,
  Terminal,
  Vote,
  GitCommit,
} from 'lucide-react';
import {
  applyFormattingToSelection,
  INTERACTIVE_WIDGET_LIBRARY,
  FormattingType,
  InteractiveWidgetTemplate,
} from '../kernel/interactiveChatLibrary';
import { InteractiveElementsLibraryModal } from './InteractiveChatWidgets';
import { FormattedMessage } from './FormattedMessage';

export interface InteractiveChatToolbarProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSendDirect?: (markdownToSend: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  disabled?: boolean;
  autoDialogueEnabled?: boolean;
  onToggleAutoDialogue?: (next?: boolean) => void;
  onTriggerAutonomousDialogue?: (topic?: string) => void;
  onTriggerAiDialogue?: () => void | Promise<void>;
  isTriggeringDialogue?: boolean;
  compact?: boolean;
}

export const InteractiveChatToolbar: React.FC<InteractiveChatToolbarProps> = ({
  value,
  onChange,
  onSendDirect,
  inputRef,
  disabled = false,
  autoDialogueEnabled = false,
  onToggleAutoDialogue,
  onTriggerAutonomousDialogue,
  onTriggerAiDialogue,
  isTriggeringDialogue = false,
  compact = false,
}) => {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showQuickWidgets, setShowQuickWidgets] = useState(!compact);

  const handleFormat = (action: FormattingType) => {
    const el = inputRef?.current;
    const start = el && typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
    const end = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : value.length;

    const result = applyFormattingToSelection(value, start, end, action);
    onChange(result.text);

    requestAnimationFrame(() => {
      if (el && typeof el.focus === 'function') {
        el.focus();
        try {
          el.setSelectionRange(result.nextCursorStart, result.nextCursorEnd);
        } catch {}
      }
    });
  };

  const handleInsertSnippet = (markdownSnippet: string) => {
    const prefix = value.trim().length > 0 ? `${value.trimEnd()}\n\n` : '';
    onChange(`${prefix}${markdownSnippet}`);
  };

  const getQuickIcon = (id: InteractiveWidgetTemplate['id']) => {
    switch (id) {
      case 'topological-calculator':
        return <Calculator className="w-3 h-3 text-emerald-400" />;
      case 'system-action-card':
        return <Cpu className="w-3 h-3 text-cyan-400" />;
      case 'interactive-checklist':
        return <CheckSquare className="w-3 h-3 text-amber-400" />;
      case 'parameter-sliders':
        return <Sliders className="w-3 h-3 text-purple-400" />;
      case 'api-endpoint-tester':
        return <Terminal className="w-3 h-3 text-blue-400" />;
      case 'sortable-data-grid':
        return <TableIcon className="w-3 h-3 text-indigo-400" />;
      case 'decision-poll':
        return <Vote className="w-3 h-3 text-rose-400" />;
      case 'stepper-workflow':
        return <GitCommit className="w-3 h-3 text-teal-400" />;
    }
  };

  const triggerDialogue = onTriggerAutonomousDialogue || onTriggerAiDialogue;

  return (
    <div className="space-y-1.5">
      {/* Row 1: Formatting buttons + Library Modal + Live Preview + Autonomous AI Dialogue */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800/90">
        {/* Left: Rich Text Formatting */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 mr-1 hidden sm:inline">
            Formatowanie:
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('bold')}
            title="Pogrubienie (**tekst**)"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('italic')}
            title="Kursywa (*tekst*)"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('strikethrough')}
            title="Przekreślenie (~~tekst~~)"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('highlight')}
            title="Wyróżnienie (==tekst==)"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 hover:text-emerald-200 border border-slate-800 transition cursor-pointer"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('inlineCode')}
            title="Kod liniowy (`kod`)"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-slate-800 transition cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('codeBlock')}
            title="Blok kodu (```typescript ... ```)"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-slate-800 transition cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('latexBlock')}
            title="Wzór matematyczny LaTeX ($$ ... $$)"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 hover:text-emerald-200 border border-slate-800 transition cursor-pointer"
          >
            <Sigma className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('table')}
            title="Wstaw tabelę danych Markdown"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
          >
            <TableIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('checklist')}
            title="Wstaw interaktywną listę zadań (- [ ])"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-slate-800 transition cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('calloutInfo')}
            title="Wstaw blok informacyjny (> [!INFO])"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-slate-800 transition cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('calloutWarning')}
            title="Wstaw blok ostrzeżenia (> [!WARNING])"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-slate-800 transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleFormat('collapsible')}
            title="Wstaw sekcję zwijaną (:::details)"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Interactive Elements Library + Autonomous AI Dialogue + Preview */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowQuickWidgets((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
              showQuickWidgets
                ? 'bg-cyan-950/60 border-cyan-600/50 text-cyan-200'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Pokaż / ukryj pasek szybkiego wstawiania widżetów interaktywnych"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Widżety (8)</span>
          </button>

          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            data-testid="open-interactive-library-btn"
            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Otwórz pełną bibliotekę interaktywnych elementów i formatowania"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Biblioteka Interaktywna</span>
          </button>

          {triggerDialogue && (
            <button
              type="button"
              onClick={() => triggerDialogue()}
              disabled={isTriggeringDialogue || disabled}
              data-testid="trigger-autonomous-dialogue-btn"
              className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 disabled:opacity-50 text-purple-200 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Wyzwól natychmiastową swobodną rozmowę między agentami AI (Alex, Astyria, Aria, Aurelius) oraz Operatorem"
            >
              <MessageSquarePlus className={`w-3.5 h-3.5 text-purple-400 ${isTriggeringDialogue ? 'animate-spin' : ''}`} />
              <span>{isTriggeringDialogue ? 'Rozmowa AI...' : 'Impuls Rozmowy AI'}</span>
            </button>
          )}

          {onToggleAutoDialogue && (
            <button
              type="button"
              onClick={() => onToggleAutoDialogue(!autoDialogueEnabled)}
              data-testid="toggle-auto-dialogue-btn"
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                autoDialogueEnabled
                  ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Włącz/wyłącz ciągły swobodny czat obustronny (AI komunikują się ze sobą i z Operatorem spontanicznie)"
            >
              <Radio className={`w-3 h-3 ${autoDialogueEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Auto-Czat AI: {autoDialogueEnabled ? 'AKTYWNY' : 'WYŁ.'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowLivePreview((prev) => !prev)}
            className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition flex items-center gap-1 cursor-pointer ${
              showLivePreview
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Podgląd sformatowanej wiadomości i widżetów na żywo"
          >
            {showLivePreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span className="hidden md:inline">Podgląd</span>
          </button>
        </div>
      </div>

      {/* Row 2: Quick Interactive Widget Chips */}
      {showQuickWidgets && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-2 rounded-lg bg-slate-950/60 border border-slate-900">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 shrink-0">
            Wstaw element:
          </span>
          {INTERACTIVE_WIDGET_LIBRARY.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleInsertSnippet(item.snippet)}
              className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[10px] text-slate-300 hover:text-white flex items-center gap-1.5 shrink-0 transition cursor-pointer"
              title={`${item.description} (Kliknij, aby wstawić do pola wiadomości)`}
            >
              {getQuickIcon(item.id)}
              <span>{item.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Live Preview Panel */}
      {showLivePreview && value.trim().length > 0 && (
        <div className="p-3 rounded-xl bg-slate-950/95 border border-cyan-500/30 space-y-1.5 max-h-72 overflow-y-auto">
          <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 border-b border-slate-800 pb-1">
            <span>PODGLĄD INTERAKTYWNEJ WIADOMOŚCI NA ŻYWO</span>
            <span>{value.length} znaków</span>
          </div>
          <FormattedMessage content={value} onSendChatCommand={onSendDirect} />
        </div>
      )}

      {/* Interactive Elements Library Modal */}
      <InteractiveElementsLibraryModal
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onInsertSnippet={(snippet: string) => handleInsertSnippet(snippet)}
        onSendDirectly={
          onSendDirect
            ? (snippet: string) => {
                onSendDirect(snippet);
              }
            : undefined
        }
      />
    </div>
  );
};
