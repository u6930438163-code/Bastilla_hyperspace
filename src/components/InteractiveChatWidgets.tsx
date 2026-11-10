import React, { useState, useMemo } from 'react';
import {
  Calculator,
  CheckSquare,
  Square,
  Plus,
  Sliders,
  Play,
  Download,
  ArrowUpDown,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  Terminal,
  RefreshCw,
  BarChart3,
  Layers,
  Sparkles,
  Copy,
  Send,
  X,
} from 'lucide-react';
import {
  ChecklistItem,
  INTERACTIVE_WIDGET_LIBRARY,
  InteractiveWidgetTemplate,
  InteractiveWidgetType,
  calculateChecklistProgress,
  computeCompactInfinityMetric,
} from '../kernel/interactiveChatLibrary';

export interface WidgetActionCallbacks {
  onSendChatCommand?: (commandText: string) => void;
}

/**
 * 1. Kalkulator Topologiczny (Compact Infinity Engine v5.5)
 */
export const TopologicalCalculatorWidget: React.FC<{
  initialConfig?: { title?: string; xStart?: number; xEnd?: number; presetInfinite?: boolean };
  onSendChatCommand?: (commandText: string) => void;
}> = ({ initialConfig, onSendChatCommand }) => {
  const [xStart, setXStart] = useState<number>(initialConfig?.xStart ?? -10);
  const [xEnd, setXEnd] = useState<number>(initialConfig?.xEnd ?? 25);
  const [useInfinity, setUseInfinity] = useState<boolean>(Boolean(initialConfig?.presetInfinite));

  const result = useMemo(() => {
    const startVal = useInfinity ? Number.NEGATIVE_INFINITY : xStart;
    const endVal = useInfinity ? Number.POSITIVE_INFINITY : xEnd;
    return computeCompactInfinityMetric(startVal, endVal);
  }, [xStart, xEnd, useInfinity]);

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-xs text-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2 font-semibold text-cyan-200">
          <Calculator className="h-4 w-4 text-cyan-400 shrink-0" />
          <span>{initialConfig?.title || 'Silnik Topologiczny Compact Infinity'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUseInfinity((prev) => !prev)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
              useInfinity
                ? 'border-cyan-500/50 bg-cyan-950/70 text-cyan-200'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
            }`}
          >
            {useInfinity ? 'Tryb: [-∞, +∞]' : 'Przełącz na [-∞, +∞]'}
          </button>
        </div>
      </div>

      {!useInfinity && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
          <label className="flex flex-col gap-1 text-[11px] text-slate-400">
            <span>Początek przedziału (x_start): <strong className="font-mono tabular-nums text-slate-200">{xStart}</strong></span>
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={xStart}
              onChange={(e) => setXStart(Number(e.target.value))}
              aria-label="Początek przedziału x_start"
              className="accent-cyan-400 cursor-pointer"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-400">
            <span>Koniec przedziału (x_end): <strong className="font-mono tabular-nums text-slate-200">{xEnd}</strong></span>
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={xEnd}
              onChange={(e) => setXEnd(Number(e.target.value))}
              aria-label="Koniec przedziału x_end"
              className="accent-cyan-400 cursor-pointer"
            />
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono tabular-nums">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
          <div className="text-[10px] text-slate-400">compact_start</div>
          <div className="mt-0.5 text-sm font-bold text-cyan-300">{result.compactStart}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
          <div className="text-[10px] text-slate-400">compact_end</div>
          <div className="mt-0.5 text-sm font-bold text-cyan-300">{result.compactEnd}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
          <div className="text-[10px] text-slate-400">Długość domeny (a)</div>
          <div className="mt-0.5 text-sm font-bold text-emerald-300">{result.domainLength}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
          <div className="text-[10px] text-slate-400">Metryka c (Pitagoras)</div>
          <div className="mt-0.5 text-sm font-bold text-amber-300">{result.metricC}</div>
        </div>
      </div>

      {onSendChatCommand && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() =>
              onSendChatCommand(
                `ustaw compact_metric_c = ${result.metricC}`,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/50 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-900/60 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Send className="h-3 w-3" />
            Zapisz metrykę c ({result.metricC}) w DATA_STORE
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * 2. Karta Akcji Systemowych Ring-0
 */
export const SystemActionCardWidget: React.FC<{
  initialConfig?: {
    title?: string;
    subtitle?: string;
    actions?: Array<{ id: string; label: string; command: string }>;
  };
  onSendChatCommand?: (commandText: string) => void;
}> = ({ initialConfig, onSendChatCommand }) => {
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);
  const actions = initialConfig?.actions || [
    { id: 'sync', label: 'Synchronizuj DATA_STORE', command: 'sync' },
    { id: 'status', label: 'Raport Stanu Jądra', command: 'SYSTEM_STATUS' },
    { id: 'audit', label: 'Audyt Rejestru', command: 'DATA_STORE_AUDIT' },
    { id: 'timeline', label: 'Oś Czasu Wersji', command: 'VERSION_TIMELINE' },
  ];

  const handleRun = (label: string, command: string) => {
    setLastTriggered(label);
    if (onSendChatCommand) {
      onSendChatCommand(command);
    }
  };

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-xs text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-3">
        <div>
          <div className="font-semibold text-slate-100">{initialConfig?.title || 'Panel Szybkich Operacji Systemowych'}</div>
          <div className="text-[11px] text-slate-400">{initialConfig?.subtitle || 'Wykonaj operację bezpośrednio w bieżącym wątku czatu'}</div>
        </div>
        {lastTriggered && (
          <span className="text-[11px] font-mono text-emerald-300">
            Wywołano: {lastTriggered}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actions.map((act) => (
          <button
            key={act.id}
            type="button"
            onClick={() => handleRun(act.label, act.command)}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-left text-xs font-medium text-slate-100 hover:border-cyan-500/40 hover:bg-slate-900 transition cursor-pointer"
          >
            <span className="truncate">{act.label}</span>
            <code className="font-mono text-[10px] text-cyan-300 shrink-0">{act.command}</code>
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * 3. Interaktywna Lista Zadań (Task Tracker)
 */
export const InteractiveChecklistWidget: React.FC<{
  initialConfig?: { title?: string; items?: ChecklistItem[] };
}> = ({ initialConfig }) => {
  const [items, setItems] = useState<ChecklistItem[]>(
    initialConfig?.items || [
      { id: '1', label: 'Synchronizacja katalogu /apps z DATA_STORE', checked: true },
      { id: '2', label: 'Weryfikacja modułu Flota Bastilla OS', checked: true },
      { id: '3', label: 'Otwarty dostęp serwera MCP (/mcp)', checked: true },
      { id: '4', label: 'Test modeli AI i formatowania interaktywnego', checked: false },
    ],
  );
  const [newItemText, setNewItemText] = useState('');

  const progress = useMemo(() => calculateChecklistProgress(items), [items]);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    setItems((prev) => [
      ...prev,
      { id: `item-${Date.now()}`, label: trimmed, checked: false },
    ]);
    setNewItemText('');
  };

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-xs text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 font-semibold text-slate-100">
          <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{initialConfig?.title || 'Interaktywna Lista Kontrolna'}</span>
        </div>
        <span className="font-mono tabular-nums text-[11px] text-emerald-300">
          {progress.completed} / {progress.total} ({progress.percent}%)
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900 mb-3">
        <div
          className="h-full bg-emerald-500 transition-transform duration-200 origin-left"
          style={{ transform: `scaleX(${progress.percent / 100})` }}
        />
      </div>

      <ul className="space-y-1.5 mb-3">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition cursor-pointer ${
                item.checked
                  ? 'border-emerald-900/50 bg-emerald-950/20 text-slate-400 line-through'
                  : 'border-slate-800 bg-slate-900/70 text-slate-100 hover:border-slate-700'
              }`}
            >
              {item.checked ? (
                <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <Square className="h-4 w-4 text-slate-500 shrink-0" />
              )}
              <span className="flex-1">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          placeholder="Dodaj nowe zadanie kontrolne…"
          aria-label="Nowe zadanie kontrolne"
          className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={!newItemText.trim()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Dodaj
        </button>
      </form>
    </div>
  );
};

/**
 * 4. Kontroler Parametrów i Kalibracji
 */
export const ParameterSlidersWidget: React.FC<{
  initialConfig?: {
    title?: string;
    parameters?: Array<{ key: string; label: string; value: number; min: number; max: number; unit: string }>;
  };
  onSendChatCommand?: (commandText: string) => void;
}> = ({ initialConfig, onSendChatCommand }) => {
  const [params, setParams] = useState(
    initialConfig?.parameters || [
      { key: 'acoustic_resonance_hz', label: 'Rezonans akustyczny', value: 880, min: 100, max: 2000, unit: 'Hz' },
      { key: 'memory_guard_limit_pct', label: 'Limit strażnika RAM (Idle)', value: 68, min: 30, max: 95, unit: '%' },
      { key: 'calibration_pattern', label: 'Wzorzec kalibracji', value: 364, min: 100, max: 999, unit: 'jednostek' },
    ],
  );
  const [appliedKey, setAppliedKey] = useState<string | null>(null);

  const updateValue = (key: string, nextVal: number) => {
    setParams((prev) => prev.map((p) => (p.key === key ? { ...p, value: nextVal } : p)));
  };

  const applyParam = (key: string, value: number) => {
    setAppliedKey(key);
    if (onSendChatCommand) {
      onSendChatCommand(`ustaw ${key} = ${value}`);
    }
    setTimeout(() => setAppliedKey(null), 2000);
  };

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-xs text-slate-200">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2 font-semibold text-slate-100">
          <Sliders className="h-4 w-4 text-cyan-400 shrink-0" />
          <span>{initialConfig?.title || 'Kalibracja Parametrów Jądra SVL'}</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Interaktywne sterowanie</span>
      </div>

      <div className="space-y-3">
        {params.map((param) => (
          <div key={param.key} className="rounded-lg border border-slate-800/90 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <span className="font-medium text-slate-200">{param.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono tabular-nums text-xs font-bold text-cyan-300">
                  {param.value} {param.unit}
                </span>
                {onSendChatCommand && (
                  <button
                    type="button"
                    onClick={() => applyParam(param.key, param.value)}
                    className="rounded border border-cyan-500/40 bg-cyan-950/50 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-900/60 transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {appliedKey === param.key ? 'Zapisano' : 'Zastosuj'}
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={param.min}
              max={param.max}
              value={param.value}
              aria-label={param.label}
              onChange={(e) => updateValue(param.key, Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 5. Interaktywny Tester Endpointów API & MCP
 */
export const ApiEndpointTesterWidget: React.FC<{
  initialConfig?: {
    title?: string;
    defaultEndpoint?: string;
    endpoints?: Array<{ label: string; path: string }>;
  };
}> = ({ initialConfig }) => {
  const endpoints = initialConfig?.endpoints || [
    { label: 'Status AI (Ollama + Gemini)', path: '/api/ai/status' },
    { label: 'Lista Aplikacji (/apps)', path: '/api/apps/list' },
    { label: 'Status Infrastruktury', path: '/api/infrastructure/status' },
    { label: 'Konfiguracja MCP ChatGPT', path: '/api/mcp/config' },
  ];
  const [selectedPath, setSelectedPath] = useState(initialConfig?.defaultEndpoint || endpoints[0].path);
  const [loading, setLoading] = useState(false);
  const [responseInfo, setResponseInfo] = useState<{
    status: number;
    elapsedMs: number;
    body: string;
  } | null>(null);

  const runTest = async (pathToTest: string) => {
    setSelectedPath(pathToTest);
    setLoading(true);
    const start = performance.now();
    try {
      const res = await fetch(pathToTest, { cache: 'no-store' });
      const elapsedMs = Math.round(performance.now() - start);
      const json = await res.json();
      setResponseInfo({
        status: res.status,
        elapsedMs,
        body: JSON.stringify(json, null, 2).slice(0, 900),
      });
    } catch (err) {
      const elapsedMs = Math.round(performance.now() - start);
      setResponseInfo({
        status: 500,
        elapsedMs,
        body: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-xs text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2 font-semibold text-slate-100">
          <Terminal className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{initialConfig?.title || 'Tester Endpointów Systemowych na Żywo'}</span>
        </div>
        <button
          type="button"
          onClick={() => void runTest(selectedPath)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/70 disabled:opacity-50 transition cursor-pointer whitespace-nowrap shrink-0"
        >
          {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Wykonaj GET {selectedPath}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {endpoints.map((ep) => (
          <button
            key={ep.path}
            type="button"
            onClick={() => void runTest(ep.path)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-mono transition cursor-pointer whitespace-nowrap shrink-0 ${
              selectedPath === ep.path
                ? 'border-cyan-500/50 bg-cyan-950/70 text-cyan-200'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            {ep.label}
          </button>
        ))}
      </div>

      {responseInfo && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 font-mono text-[11px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2 text-[10px]">
            <span className={responseInfo.status < 400 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              HTTP {responseInfo.status}
            </span>
            <span className="tabular-nums text-slate-400">Czas odpowiedzi: {responseInfo.elapsedMs} ms</span>
          </div>
          <pre className="max-h-48 overflow-auto text-slate-300 leading-relaxed">{responseInfo.body}</pre>
        </div>
      )}
    </div>
  );
};

/**
 * 6. Tabela Interaktywna z Filtrem, Sortowaniem i Eksportem CSV
 */
export const SortableDataGridWidget: React.FC<{
  initialConfig?: {
    title?: string;
    columns?: string[];
    rows?: string[][];
  };
}> = ({ initialConfig }) => {
  const columns = initialConfig?.columns || ['Moduł', 'Kategoria', 'Status', 'Ścieżka'];
  const initialRows = initialConfig?.rows || [
    ['Flota Bastilla OS', 'html5-web', 'ACTIVE_RING0', '/apps/flota'],
    ['ChatGPT MCP Server', 'mcp-connector', 'OPEN', '/mcp'],
    ['Matrix Telemetry', 'html5-web', 'READY', '/apps/matrix-telemetry'],
    ['Raw Socket RX Monitor', 'python-microservice', 'RUNNING', '3200/TCP'],
  ];

  const [query, setQuery] = useState('');
  const [sortCol, setSortCol] = useState<number>(0);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? initialRows.filter((r) => r.some((cell) => cell.toLowerCase().includes(q)))
      : [...initialRows];

    return filtered.sort((a, b) => {
      const valA = a[sortCol] || '';
      const valB = b[sortCol] || '';
      return sortAsc ? valA.localeCompare(valB, 'pl') : valB.localeCompare(valA, 'pl');
    });
  }, [initialRows, query, sortCol, sortAsc]);

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortAsc((prev) => !prev);
    } else {
      setSortCol(colIdx);
      setSortAsc(true);
    }
  };

  const handleDownloadCsv = () => {
    const csvLines = [
      columns.join(','),
      ...filteredAndSorted.map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bastilla_data_export.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-xs text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-semibold text-slate-100">
          {initialConfig?.title || 'Interaktywna Tabela Danych'}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtruj wiersze…"
              aria-label="Filtruj wiersze tabeli"
              className="rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-2.5 py-1 text-[11px] text-slate-100 outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="h-3 w-3 text-cyan-400" />
            Eksport CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left border-collapse text-[11px] tabular-nums">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-200">
              {columns.map((col, idx) => (
                <th key={col} className="py-2 px-3 font-semibold whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort(idx)}
                    className="inline-flex items-center gap-1 hover:text-cyan-300 cursor-pointer"
                  >
                    <span>{col}</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredAndSorted.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-900/50 transition-colors">
                {columns.map((_, cIdx) => (
                  <td key={cIdx} className="py-2 px-3 text-slate-300">
                    {row[cIdx] || '—'}
                  </td>
                ))}
              </tr>
            ))}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-4 text-center text-slate-500">
                  Brak wyników pasujących do filtra „{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * 7. Macierz Decyzyjna / Ankieta Operacyjna
 */
export const DecisionPollWidget: React.FC<{
  initialConfig?: {
    question?: string;
    options?: Array<{ id: string; label: string; votes: number }>;
  };
}> = ({ initialConfig }) => {
  const [options, setOptions] = useState(
    initialConfig?.options || [
      { id: 'opt-1', label: 'Rozbudowa modułu Floty i telemetrii czasu rzeczywistego', votes: 5 },
      { id: 'opt-2', label: 'Integracja dodatkowych narzędzi w serwerze MCP dla ChatGPT', votes: 3 },
      { id: 'opt-3', label: 'Optymalizacja buforów pamięci VM_Ten_System', votes: 2 },
    ],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const totalVotes = useMemo(
    () => options.reduce((acc, item) => acc + item.votes, 0),
    [options],
  );

  const handleVote = (id: string) => {
    if (selectedId === id) return;
    setOptions((prev) =>
      prev.map((opt) => {
        if (opt.id === id) return { ...opt, votes: opt.votes + 1 };
        if (opt.id === selectedId) return { ...opt, votes: Math.max(0, opt.votes - 1) };
        return opt;
      }),
    );
    setSelectedId(id);
  };

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-xs text-slate-200">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 font-semibold text-slate-100">
          <BarChart3 className="h-4 w-4 text-cyan-400 shrink-0" />
          <span>{initialConfig?.question || 'Macierz Decyzyjna Operacji'}</span>
        </div>
        <span className="font-mono tabular-nums text-[11px] text-slate-400">
          Łącznie głosów: {totalVotes}
        </span>
      </div>

      <div className="space-y-2">
        {options.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          const isSelected = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleVote(opt.id)}
              className={`w-full rounded-lg border p-2.5 text-left transition cursor-pointer ${
                isSelected
                  ? 'border-cyan-500/60 bg-cyan-950/30'
                  : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-medium text-slate-100">{opt.label}</span>
                <span className="font-mono tabular-nums text-[11px] text-cyan-300 shrink-0">
                  {pct}% ({opt.votes})
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950">
                <div
                  className="h-full bg-cyan-400 transition-transform duration-200 origin-left"
                  style={{ transform: `scaleX(${pct / 100})` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 8. Kreator Procedury Krok po Kroku (Stepper)
 */
export const StepperWorkflowWidget: React.FC<{
  initialConfig?: {
    title?: string;
    steps?: Array<{ title: string; detail: string }>;
  };
}> = ({ initialConfig }) => {
  const steps = initialConfig?.steps || [
    { title: 'Inicjalizacja manifestu', detail: 'Utworzenie katalogu w /apps/<id> wraz z plikiem app.json oraz punktem wejścia index.html.' },
    { title: 'Rejestracja w DATA_STORE', detail: 'Wywołanie skanera scanAppsDirectory() i aktualizacja listy synced_apps w pliku .svl_kernel_store.json.' },
    { title: 'Rozgłoszenie zdarzenia UI', detail: 'Wysłanie sygnału svl-apps-sync do wszystkich otwartych zakładek bez przeładowania strony.' },
    { title: 'Weryfikacja w MCP i Studio', detail: 'Potwierdzenie dostępności modułu w Studio Aplikacji oraz przez endpoint /api/apps/list.' },
  ];
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-xs text-slate-200">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2 font-semibold text-slate-100">
          <Layers className="h-4 w-4 text-cyan-400 shrink-0" />
          <span>{initialConfig?.title || 'Procedura Techniczna Krok po Kroku'}</span>
        </div>
        <span className="font-mono tabular-nums text-[11px] text-cyan-300">
          Krok {activeStep + 1} z {steps.length}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
        {steps.map((step, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveStep(idx)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
              idx === activeStep
                ? 'border-cyan-500/60 bg-cyan-950/70 text-cyan-200'
                : idx < activeStep
                ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300'
                : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            {idx + 1}. {step.title}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 mb-3">
        <div className="font-semibold text-slate-100 mb-1">
          {activeStep + 1}. {steps[activeStep]?.title}
        </div>
        <p className="text-slate-300 leading-relaxed">{steps[activeStep]?.detail}</p>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={activeStep === 0}
          onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Poprzedni krok
        </button>
        <button
          type="button"
          disabled={activeStep >= steps.length - 1}
          onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))}
          className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-950/60 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-900/70 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
        >
          Następny krok
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

/**
 * Dispatcher for `widget:<type>` blocks inside FormattedMessage
 */
export const InteractiveWidgetBlock: React.FC<{
  widgetType: string;
  rawJson: string;
  onSendChatCommand?: (commandText: string) => void;
}> = ({ widgetType, rawJson, onSendChatCommand }) => {
  let parsed: any = {};
  try {
    if (rawJson.trim()) {
      parsed = JSON.parse(rawJson);
    }
  } catch {
    parsed = {};
  }

  const normalizedType = widgetType.trim().toLowerCase() as InteractiveWidgetType;

  switch (normalizedType) {
    case 'topological-calculator':
      return <TopologicalCalculatorWidget initialConfig={parsed} onSendChatCommand={onSendChatCommand} />;
    case 'system-action-card':
      return <SystemActionCardWidget initialConfig={parsed} onSendChatCommand={onSendChatCommand} />;
    case 'interactive-checklist':
      return <InteractiveChecklistWidget initialConfig={parsed} />;
    case 'parameter-sliders':
      return <ParameterSlidersWidget initialConfig={parsed} onSendChatCommand={onSendChatCommand} />;
    case 'api-endpoint-tester':
      return <ApiEndpointTesterWidget initialConfig={parsed} />;
    case 'sortable-data-grid':
      return <SortableDataGridWidget initialConfig={parsed} />;
    case 'decision-poll':
      return <DecisionPollWidget initialConfig={parsed} />;
    case 'stepper-workflow':
      return <StepperWorkflowWidget initialConfig={parsed} />;
    default:
      return <TopologicalCalculatorWidget initialConfig={parsed} onSendChatCommand={onSendChatCommand} />;
  }
};

/**
 * Biblioteka Elementów Interaktywnych (Interactive Elements Library Browser & Live Preview)
 */
export const InteractiveElementsLibraryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onInsertSnippet: (snippet: string) => void;
  onSendDirectly?: (snippet: string) => void;
}> = ({ isOpen, onClose, onInsertSnippet, onSendDirectly }) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'system' | 'data' | 'math' | 'workflow'>('all');
  const [previewWidgetId, setPreviewWidgetId] = useState<InteractiveWidgetType>('topological-calculator');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredWidgets = INTERACTIVE_WIDGET_LIBRARY.filter(
    (w) => selectedCategory === 'all' || w.category === selectedCategory,
  );

  const activeTemplate: InteractiveWidgetTemplate =
    INTERACTIVE_WIDGET_LIBRARY.find((w) => w.id === previewWidgetId) || INTERACTIVE_WIDGET_LIBRARY[0];

  const extractJsonFromSnippet = (snippet: string) => {
    const lines = snippet.split('\n');
    return lines.slice(1, -1).join('\n');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Biblioteka Elementów Interaktywnych i Formatowania"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#07101e] text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-white">
              Biblioteka Elementów Interaktywnych i Formatowania Czatu
            </h2>
            <p className="text-[11px] text-slate-400">
              Wybierz gotowy komponent interaktywny, przetestuj go na żywo i wstaw do rozmowy lub wyślij jednym kliknięciem
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij bibliotekę elementów interaktywnych"
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 bg-slate-950/60 px-5 py-2.5">
          {[
            { id: 'all', label: 'Wszystkie komponenty (8)' },
            { id: 'system', label: 'Sterowanie Systemem' },
            { id: 'data', label: 'Dane & Tester API' },
            { id: 'math', label: 'Matematyka & Topologia' },
            { id: 'workflow', label: 'Zadania & Workflow' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as typeof selectedCategory)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-cyan-950 text-cyan-200 border border-cyan-500/40'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Two-column body: Catalog list + Live Interactive Preview */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12">
          <div className="border-b border-slate-800 p-4 space-y-2.5 lg:col-span-5 lg:border-b-0 lg:border-r lg:overflow-y-auto">
            {filteredWidgets.map((widget) => {
              const isSelected = widget.id === activeTemplate.id;
              return (
                <div
                  key={widget.id}
                  onClick={() => setPreviewWidgetId(widget.id)}
                  className={`rounded-xl border p-3.5 transition cursor-pointer ${
                    isSelected
                      ? 'border-cyan-500/50 bg-cyan-950/25'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-100">{widget.title}</span>
                    <span className="text-[10px] font-mono text-cyan-300 shrink-0">{widget.categoryLabel}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    {widget.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInsertSnippet(widget.snippet);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-950/60 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-900/70 transition cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-3 w-3" />
                      Wstaw do edytora
                    </button>
                    {onSendDirectly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendDirectly(widget.snippet);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/70 transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Send className="h-3 w-3" />
                        Wyślij od razu w czacie
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(widget.snippet);
                        setCopiedId(widget.id);
                        setTimeout(() => setCopiedId(null), 1800);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 transition cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copiedId === widget.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedId === widget.id ? 'Skopiowano' : 'Kopiuj kod'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Preview Pane */}
          <div className="p-4 sm:p-5 lg:col-span-7 lg:overflow-y-auto bg-slate-950/50">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-cyan-200">
                Podgląd Interaktywny na Żywo: {activeTemplate.title}
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                widget:{activeTemplate.id}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Poniższy widżet jest w pełni funkcjonalny — możesz przesuwać suwaki, klikać przyciski, sortować kolumny i testować zachowanie przed wstawieniem do wiadomości:
            </p>

            <InteractiveWidgetBlock
              widgetType={activeTemplate.id}
              rawJson={extractJsonFromSnippet(activeTemplate.snippet)}
            />

            <div className="mt-4">
              <div className="text-[11px] font-mono text-slate-400 mb-1.5">
                Składnia Markdown widżetu (możesz dowolnie edytować parametry JSON):
              </div>
              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-cyan-200 overflow-x-auto">
                {activeTemplate.snippet}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
