export type FormattingType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'highlight'
  | 'inlineCode'
  | 'codeBlock'
  | 'latexInline'
  | 'latexBlock'
  | 'quote'
  | 'calloutInfo'
  | 'calloutWarning'
  | 'calloutSuccess'
  | 'checklist'
  | 'table'
  | 'collapsible'
  | 'kbd';

export type InteractiveWidgetType =
  | 'topological-calculator'
  | 'system-action-card'
  | 'interactive-checklist'
  | 'parameter-sliders'
  | 'decision-poll'
  | 'sortable-data-grid'
  | 'api-endpoint-tester'
  | 'stepper-workflow';

export interface InteractiveWidgetTemplate {
  id: InteractiveWidgetType;
  title: string;
  category: 'system' | 'data' | 'math' | 'workflow';
  categoryLabel: string;
  description: string;
  snippet: string;
}

export interface CompactInfinityResult {
  rawStart: number;
  rawEnd: number;
  compactStart: number;
  compactEnd: number;
  domainLength: number;
  metricC: number;
}

export function compactifyValue(x: number): number {
  if (x === Number.NEGATIVE_INFINITY) return -1.0;
  if (x === Number.POSITIVE_INFINITY) return 1.0;
  if (Number.isNaN(x)) return 0.0;
  return x / (1.0 + Math.abs(x));
}

export function computeCompactInfinityMetric(xStart: number, xEnd: number): CompactInfinityResult {
  const compactStart = compactifyValue(xStart);
  const compactEnd = compactifyValue(xEnd);
  const domainLength = Math.abs(compactEnd - compactStart);
  const a = domainLength;
  const b = Math.abs(compactStart * compactEnd) + 0.5;
  const metricC = Math.sqrt(a * a + b * b);

  return {
    rawStart: xStart,
    rawEnd: xEnd,
    compactStart: Number(compactStart.toFixed(6)),
    compactEnd: Number(compactEnd.toFixed(6)),
    domainLength: Number(domainLength.toFixed(6)),
    metricC: Number(metricC.toFixed(6)),
  };
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export function calculateChecklistProgress(items: ChecklistItem[]): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = items.length;
  if (total === 0) {
    return { completed: 0, total: 0, percent: 0 };
  }
  const completed = items.filter((item) => item.checked).length;
  const percent = Math.round((completed / total) * 100);
  return { completed, total, percent };
}

export function applyFormattingToSelection(
  fullText: string,
  selectionStart: number,
  selectionEnd: number,
  format: FormattingType,
): { text: string; nextCursorStart: number; nextCursorEnd: number } {
  const safeStart = Math.max(0, Math.min(selectionStart, fullText.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, fullText.length));
  const before = fullText.slice(0, safeStart);
  const selected = fullText.slice(safeStart, safeEnd);
  const after = fullText.slice(safeEnd);

  const wrap = (prefix: string, suffix: string, placeholder: string) => {
    const inner = selected || placeholder;
    const inserted = `${prefix}${inner}${suffix}`;
    const nextStart = safeStart + prefix.length;
    const nextEnd = nextStart + inner.length;
    return {
      text: `${before}${inserted}${after}`,
      nextCursorStart: nextStart,
      nextCursorEnd: nextEnd,
    };
  };

  switch (format) {
    case 'bold':
      return wrap('**', '**', 'pogrubiony tekst');
    case 'italic':
      return wrap('*', '*', 'kursywa');
    case 'underline':
      return wrap('<u>', '</u>', 'podkreślony tekst');
    case 'strikethrough':
      return wrap('~~', '~~', 'przekreślony tekst');
    case 'highlight':
      return wrap('==', '==', 'wyróżniony fragment');
    case 'inlineCode':
      return wrap('`', '`', 'kod');
    case 'kbd':
      return wrap('<kbd>', '</kbd>', 'Ctrl+K');
    case 'codeBlock':
      return wrap('\n```typescript\n', '\n```\n', 'const status = "ACTIVE_RING0";\nconsole.log(status);');
    case 'latexInline':
      return wrap('$', '$', '\\frac{x}{1 + |x|}');
    case 'latexBlock':
      return wrap('\n$$\n', '\n$$\n', 'c = \\sqrt{(x_2 - x_1)^2 + (|x_1 \\cdot x_2| + 0.5)^2}');
    case 'quote':
      return wrap('\n> ', '\n', 'Cytat lub kluczowy wniosek inżynieryjny');
    case 'calloutInfo':
      return wrap(
        '\n> [!INFO] Informacja systemowa\n> ',
        '\n',
        'Kanał synchronizacji DATA_STORE pracuje w trybie dwukierunkowym.',
      );
    case 'calloutWarning':
      return wrap(
        '\n> [!WARNING] Ostrzeżenie operacyjne\n> ',
        '\n',
        'Zweryfikuj parametry przed zapisem do rejestru.',
      );
    case 'calloutSuccess':
      return wrap(
        '\n> [!TIP] Wskazówka optymalizacyjna\n> ',
        '\n',
        'Użyj widżetu testera API, aby zweryfikować czas odpowiedzi endpointu.',
      );
    case 'checklist':
      return wrap(
        '\n- [x] ',
        '\n- [ ] Weryfikacja integralności modułów /apps\n- [ ] Eksport migawki stanu\n',
        'Synchronizacja jądra SVL',
      );
    case 'table':
      return wrap(
        '\n| Moduł | Status | Czas odpowiedzi | Wersja |\n| :--- | :--- | :--- | :--- |\n| ',
        ' | ONLINE | 12 ms | 9.0.0 |\n| Flota Bastilla | ACTIVE | 8 ms | 9.0.0 |\n| Serwer MCP | OPEN | 5 ms | 1.0.0 |\n',
        'Jądro SVL',
      );
    case 'collapsible':
      return wrap(
        '\n:::details Specyfikacja techniczna modułu\n',
        '\n:::\n',
        'Szczegółowe parametry konfiguracyjne oraz logi diagnostyczne.',
      );
  }
}

export const INTERACTIVE_WIDGET_LIBRARY: InteractiveWidgetTemplate[] = [
  {
    id: 'topological-calculator',
    title: 'Kalkulator Topologiczny (Compact Infinity)',
    category: 'math',
    categoryLabel: 'Matematyka & Topologia',
    description: 'Interaktywny moduł obliczający rzutowanie stereograficzne x/(1+|x|) oraz metrykę c na przedziale zwartym [-1, 1].',
    snippet: [
      '```widget:topological-calculator',
      JSON.stringify(
        {
          title: 'Silnik Topologiczny Compact Infinity v5.5',
          xStart: -10,
          xEnd: 25,
          presetInfinite: false,
        },
        null,
        2,
      ),
      '```',
    ].join('\n'),
  },
  {
    id: 'system-action-card',
    title: 'Karta Akcji Systemowych Ring-0',
    category: 'system',
    categoryLabel: 'Sterowanie Systemem',
    description: 'Zestaw interaktywnych przycisków wywołujących natychmiastową synchronizację, diagnostykę AI i skan modułów bezpośrednio z czatu.',
    snippet: [
      '```widget:system-action-card',
      JSON.stringify(
        {
          title: 'Panel Szybkich Operacji Systemowych',
          subtitle: 'Wykonaj operację bezpośrednio w bieżącym wątku czatu',
          actions: [
            { id: 'sync', label: 'Synchronizuj DATA_STORE', command: 'sync' },
            { id: 'status', label: 'Raport Stanu Jądra', command: 'SYSTEM_STATUS' },
            { id: 'audit', label: 'Audyt Rejestru', command: 'DATA_STORE_AUDIT' },
            { id: 'timeline', label: 'Oś Czasu Wersji', command: 'VERSION_TIMELINE' },
          ],
        },
        null,
        2,
      ),
      '```',
    ].join('\n'),
  },
  {
    id: 'interactive-checklist',
    title: 'Interaktywna Lista Zadań (Task Tracker)',
    category: 'workflow',
    categoryLabel: 'Workflow & Zadania',
    description: 'Lista kontrolna z paskiem postępu na żywo, możliwością odznaczania kroków oraz dodawania własnych pozycji w wiadomości.',
    snippet: [
      '```widget:interactive-checklist',
      JSON.stringify(
        {
          title: 'Lista Kontrolna Wdrożenia Modułów',
          items: [
            { id: 'step-1', label: 'Synchronizacja katalogu /apps z DATA_STORE', checked: true },
            { id: 'step-2', label: 'Weryfikacja modułu Flota Bastilla OS', checked: true },
            { id: 'step-3', label: 'Otwarty dostęp serwera MCP (/mcp bez tokena)', checked: true },
            { id: 'step-4', label: 'Test obciążeniowy łańcucha Ollama 14B + Gemini Fallback', checked: false },
          ],
        },
        null,
        2,
      ),
      '```',
    ].join('\n'),
  },
  {
    id: 'parameter-sliders',
    title: 'Kontroler Parametrów i Kalibracji',
    category: 'system',
    categoryLabel: 'Sterowanie Systemem',
    description: 'Interaktywne suwaki parametrów systemowych (częstotliwość rezonansu, próg pamięci RAM, pula wątków) z zapisem do konfiguracji.',
    snippet: [
      '```widget:parameter-sliders',
      JSON.stringify(
        {
          title: 'Kalibracja Parametrów Jądra SVL',
          parameters: [
            { key: 'acoustic_resonance_hz', label: 'Rezonans akustyczny', value: 880, min: 100, max: 2000, unit: 'Hz' },
            { key: 'memory_guard_limit_pct', label: 'Limit strażnika RAM (Idle)', value: 68, min: 30, max: 95, unit: '%' },
            { key: 'calibration_pattern', label: 'Wzorzec kalibracji', value: 364, min: 100, max: 999, unit: 'jednostek' },
          ],
        },
        null,
        2,
      ),
      '```',
    ].join('\n'),
  },
  {
    id: 'api-endpoint-tester',
    title: 'Interaktywny Tester Endpointów API & MCP',
    category: 'data',
    categoryLabel: 'Dane & Diagnostyka',
    description: 'Narzędzie wbudowane w czat do odpytywania lokalnych endpointów (/api/ai/status, /api/apps/list, /api/infrastructure/status) z pomiarem opóźnienia.',
    snippet: [
      '```widget:api-endpoint-tester',
      JSON.stringify(
        {
          title: 'Tester Endpointów Systemowych na Żywo',
          defaultEndpoint: '/api/ai/status',
          endpoints: [
            { label: 'Status AI (Ollama + Gemini)', path: '/api/ai/status' },
            { label: 'Lista Aplikacji (/apps)', path: '/api/apps/list' },
            { label: 'Status Infrastruktury', path: '/api/infrastructure/status' },
            { label: 'Konfiguracja MCP ChatGPT', path: '/api/mcp/config' },
          ],
        },
        null,
        2,
      ),
      '```',
    ].join('\n'),
  },
  {
    id: 'sortable-data-grid',
    title: 'Tabela Interaktywna z Filtrem i Eksportem CSV',
    category: 'data',
    categoryLabel: 'Dane & Diagnostyka',
    description: 'Zaawansowana tabela danych z wyszukiwarką wierszy, sortowaniem kolumn oraz przyciskiem pobrania pliku CSV.',
    snippet: [
      '```widget:sortable-data-grid',
      JSON.stringify(
        {
          title: 'Zestawienie Modułów i Usług Bastilla OS',
          columns: ['Moduł', 'Kategoria', 'Status', 'Port / Ścieżka'],
          rows: [
            ['Flota Bastilla OS', 'html5-web', 'ACTIVE_RING0', '/apps/flota'],
            ['ChatGPT MCP Server', 'mcp-connector', 'OPEN', '/mcp'],
            ['Matrix Telemetry', 'html5-web', 'READY', '/apps/matrix-telemetry'],
            ['Raw Socket RX Monitor', 'python-microservice', 'RUNNING', '3200/TCP'],
            ['AI Desktop Nexus', 'virtual-desktop', 'ACTIVE', '6080/TCP'],
          ],
        },
        null,
        2,
      ),
      '```',
    ].join('\n'),
  },
  {
    id: 'decision-poll',
    title: 'Macierz Decyzyjna / Ankieta Operacyjna',
    category: 'workflow',
    categoryLabel: 'Workflow & Zadania',
    description: 'Interaktywny komponent wyboru strategii z natychmiastowym przeliczaniem głosów i rozkładem procentowym.',
    snippet: [
      '```widget:decision-poll',
      JSON.stringify(
        {
          question: 'Priorytet kolejnego cyklu rozwojowego Bastilla OS:',
          options: [
            { id: 'opt-1', label: 'Rozbudowa modułu Floty i telemetrii czasu rzeczywistego', votes: 5 },
            { id: 'opt-2', label: 'Integracja dodatkowych narzędzi w serwerze MCP dla ChatGPT', votes: 3 },
            { id: 'opt-3', label: 'Optymalizacja buforów pamięci VM_Ten_System', votes: 2 },
          ],
        },
        null,
        2,
      ),
      '```',
    ].join('\n'),
  },
  {
    id: 'stepper-workflow',
    title: 'Kreator Procedury Krok po Kroku (Stepper)',
    category: 'workflow',
    categoryLabel: 'Workflow & Zadania',
    description: 'Interaktywna oś kroków pozwalająca przechodzić przez etapy procedury technicznej i weryfikować każdy etap.',
    snippet: [
      '```widget:stepper-workflow',
      JSON.stringify(
        {
          title: 'Procedura Synchronizacji i Publikacji Modułu',
          steps: [
            { title: 'Inicjalizacja manifestu', detail: 'Utworzenie katalogu w /apps/<id> wraz z plikiem app.json oraz punktem wejścia index.html.' },
            { title: 'Rejestracja w DATA_STORE', detail: 'Wywołanie skanera scanAppsDirectory() i aktualizacja listy synced_apps w pliku .svl_kernel_store.json.' },
            { title: 'Rozgłoszenie zdarzenia UI', detail: 'Wysłanie sygnału svl-apps-sync do wszystkich otwartych zakładek bez przeładowania strony.' },
            { title: 'Weryfikacja w MCP i Studio', detail: 'Potwierdzenie dostępności modułu w Studio Aplikacji oraz przez endpoint /api/apps/list.' },
          ],
        },
        null,
        2,
      ),
      '```',
    ].join('\n'),
  },
];

export interface ParsedCallout {
  kind: 'INFO' | 'WARNING' | 'TIP' | 'NOTE' | 'IMPORTANT';
  title: string;
  body: string;
}

export function parseCalloutBlock(lines: string[]): ParsedCallout | null {
  if (lines.length === 0) return null;
  const first = lines[0].trim();
  const headerMatch = first.match(/^>\s*\[!(INFO|WARNING|TIP|NOTE|IMPORTANT)\]\s*(.*)$/i);
  if (!headerMatch) return null;
  const kind = headerMatch[1].toUpperCase() as ParsedCallout['kind'];
  const defaultTitles: Record<ParsedCallout['kind'], string> = {
    INFO: 'Informacja techniczna',
    WARNING: 'Ostrzeżenie',
    TIP: 'Wskazówka',
    NOTE: 'Notatka',
    IMPORTANT: 'Kluczowy parametr',
  };
  const title = headerMatch[2]?.trim() || defaultTitles[kind];
  const bodyLines = lines
    .slice(1)
    .map((line) => line.trim().replace(/^>\s?/, ''))
    .filter((line) => line.length > 0);
  return {
    kind,
    title,
    body: bodyLines.join('\n'),
  };
}
