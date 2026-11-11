import { TRIAD_AGENT_NAMES } from './agentProtocol.ts';

export interface KernelConfig {
  mode: string;
  active_profiles: string[];
  fiction_layer_status: string;
  persistence_engine: string;
  [key: string]: any;
}

export interface UpdateRecord {
  wersja: string;
  data: string;
  opis: string;
}

export interface FileAttachment {
  name: string;
  type: string;
  size?: number;
  dataUrl?: string;
  textContent?: string;
}

export interface ChatRecord {
  agent: string;
  tekst: string;
  id?: string;
  timestamp?: string;
  file?: FileAttachment;
}

export interface DataStore {
  config: KernelConfig;
  update_history: UpdateRecord[];
  chat_history: ChatRecord[];
}

export const INITIAL_DATA_STORE: DataStore = {
  config: {
    sys_version: "9.2.0-Fleet-And-Ui-Sync",
    mode: "Local-Deterministic-Production",
    active_profiles: [...TRIAD_AGENT_NAMES],
    fiction_layer_status: "DEACTIVATED_PERMANENTLY",
    persistence_engine: "Server-Disk-Backed-DATA_STORE",
    operator_name: "Mateusz Mitek",
    operator_title: "Tata",
    preferred_address: "Tata",
    sovereign_mode: true,
    static_templates: "PURGED_PERMANENTLY",
    file_transmission_channel: "ENABLED",
    infrastructure_commander: "Alex",
    astyria_continuous_repair: false,
    ui_layout: {
      headerMode: 'ring0-minimal',
      title: 'BASTILLA OS',
      subtitle: 'SVL SYSTEM · CENTRUM OPERACYJNE',
      accentColor: 'purple',
      showQuickNav: true,
      showTelemetryPill: true,
      showNotifications: true,
      lastUpdatedBy: 'System',
      updatedAt: new Date().toISOString(),
      notifications: []
    },
    vm_ten_system: { auto_snapshot_api: "MANUAL_ONLY" },
    log_auto_repair: { enabled: false },
    continuous_mission: "INACTIVE",
    root_privileges: false,
    root_agents: [],
    privilege_level: "STANDARD_UNVERIFIED",
    operator_privilege_level: "OPERATOR_SESSION",
    chat_approvals: "REQUIRED_FOR_MUTATIONS",
    global_sync_status: "ACTIVE_REALTIME_SYNC",
    performance_boost: "+1456% (Wzorzec Kalibracji: 364)",
    simulation_elements: "PURGED_ZERO_FICTION"
  },
  update_history: [],
  chat_history: []
};

export const OPERATOR_NAME = "Mateusz Mitek";
export const OPERATOR_TITLE = "Tata";
export const SYS_VERSION = "9.2.0-Fleet-And-Ui-Sync";

/**
 * Safely normalizes any raw or nested DataStore object (e.g. { store: { config, update_history, chat_history } })
 * so UI components never encounter undefined config, update_history, or chat_history.
 */
export function normalizeDataStore(raw: any): DataStore {
  if (!raw || typeof raw !== 'object') {
    return {
      config: { ...INITIAL_DATA_STORE.config },
      update_history: [],
      chat_history: [],
    };
  }

  let candidate = raw;
  // Unwrap nested { store: ... } wrappers if present
  while (candidate && typeof candidate === 'object' && candidate.store && typeof candidate.store === 'object' && !Array.isArray(candidate.chat_history)) {
    candidate = candidate.store;
  }

  const config: KernelConfig =
    candidate.config && typeof candidate.config === 'object'
      ? { ...INITIAL_DATA_STORE.config, ...candidate.config }
      : { ...INITIAL_DATA_STORE.config };
  for (const legacyModelKey of ['dialogue_engine', 'ai_provider', 'ai_model', 'live_ai_engine']) {
    delete config[legacyModelKey];
  }
  if (typeof config.mode === 'string' && (/ollama/i.test(config.mode) || /gemini/i.test(config.mode))) {
    config.mode = INITIAL_DATA_STORE.config.mode;
  }
  if (!Array.isArray(config.active_profiles) || config.active_profiles.length === 0) {
    config.active_profiles = [...TRIAD_AGENT_NAMES];
  }

  const update_history: UpdateRecord[] =
    Array.isArray(candidate.update_history)
      ? candidate.update_history
      : [...INITIAL_DATA_STORE.update_history];

  const rawChat =
    Array.isArray(candidate.chat_history)
      ? candidate.chat_history
          .filter((m: any) => m && typeof m.agent === 'string' && typeof m.tekst === 'string')
          .map((m: any) => ({
            ...m,
            agent: m.agent === 'si_1' ? 'Aria' : m.agent,
          }))
      : INITIAL_DATA_STORE.chat_history;

  // Purge all bogus NLP fallback messages and deduplicate
  const cleanChat: ChatRecord[] = [];
  const isBogusNlpMessage = (text: string): boolean => {
    const t = text.trim();
    return (
      t.includes('W temacie „') ||
      t.includes('Odnosząc się do „') ||
      t.includes('Analizując zagadnienie „') ||
      t.includes('Tato, w kwestii „') ||
      t.includes('wszystko jest zsynchronizowane i gotowe do dalszej rozmowy. Chętnie rozwinę ten wątek') ||
      t.includes('Globalna synchronizacja i łańcuch AI (ollama:dolphin-uncensored:14b) działają płynnie — jestem gotowa do dalszej rozmowy') ||
      t.includes('Potwierdzam pełną spójność konfiguracji i bezpieczeństwa systemu. Chętnie rozwinę ten temat') ||
      t.includes('przeanalizowałem Twoją wiadomość:') ||
      t.includes('dokładnie przeanalizowałam Twoje słowa:') ||
      t.includes('z uwagą zapisałem w Chronolicie') ||
      t.includes('przeprowadziłem pełny przegląd i naprawę warstwy') ||
      t.includes('już nie będziemy powtarzać krótkich, szablonowych') ||
      t.includes('z perspektywy infrastruktury Ring-0 (wersja') ||
      t.includes('powiązałam ten temat z naszym rejestrem') ||
      t.includes('Potwierdzam gotowość do dalszych działań w ramach misji') ||
      t.includes('System Bastilla OS działa stabilnie. Czy chcesz abym') ||
      t.includes('Dziękuję za wiadomość. Analizuję Twoje polecenie') ||
      t.includes('Jestem gotów do pomocy w zarządzaniu infrastrukturą')
    );
  };

  for (let i = 0; i < rawChat.length; i++) {
    const m = rawChat[i];
    if (isBogusNlpMessage(m.tekst)) {
      continue;
    }
    // If this is a user message whose ONLY replies were bogus NLP messages, skip the orphaned user message too
    if ((m.agent === 'Mateusz Mitek' || m.agent === 'Operator') && i + 1 < rawChat.length) {
      let hasValidReply = false;
      let hasAnyReply = false;
      for (let j = i + 1; j < rawChat.length; j++) {
        const next = rawChat[j];
        if (next.agent === 'Mateusz Mitek' || next.agent === 'Operator') break;
        hasAnyReply = true;
        if (!isBogusNlpMessage(next.tekst)) {
          hasValidReply = true;
          break;
        }
      }
      if (hasAnyReply && !hasValidReply) {
        continue;
      }
    }

    if (cleanChat.length > 0 && cleanChat[cleanChat.length - 1].agent === m.agent && cleanChat[cleanChat.length - 1].tekst === m.tekst) {
      continue;
    }

    cleanChat.push(m);
  }

  return {
    config,
    update_history,
    chat_history: cleanChat,
  };
}

/**
 * Generates the complete, self-modifying Python script matching the user's specification
 */
export function generatePythonMonolith(rawStore: DataStore, operator: string = OPERATOR_NAME, version?: string): string {
  const store = normalizeDataStore(rawStore);
  const activeVersion =
    version ||
    store?.config?.sys_version ||
    store?.update_history?.[store.update_history.length - 1]?.wersja ||
    SYS_VERSION;
  const serializedJson = JSON.stringify(store, null, 4);

  return `# ==============================================================================
# SVL KERNEL v${activeVersion} | OLLAMA UNCENSORED 14B + GEMINI FALLBACK
# ==============================================================================
# Instrukcja wdrożenia: Skopiuj cały ten plik i wklej go jako tekst inicjalizacyjny.
# System nadpisuje sekcję DATA_STORE w pliku lokalnym przy użyciu mechanizmu znaczników.

import json
import time
from datetime import datetime

# <<<DATA_STORE_START>>>
DATA_STORE = ${serializedJson}
# <<<DATA_STORE_END>>>

class SVLStudioKernel:
    def __init__(self):
        self.operator = "${operator}"
        self.sys_version = "${activeVersion}"
        self.store = DATA_STORE

    def synchronizuj_i_generuj_zrzut(self, nowa_wiadomosc=None, nazwa_agenta=None, nowa_konfig=None, opis_aktualizacji=None):
        """Aktualizuje słownik stanu i przygotowuje pełny kod skryptu gotowy do ponownego wklejenia."""
        if nowa_konfig:
            self.store["config"].update(nowa_konfig)
        if opis_aktualizacji:
            self.store["update_history"].append({
                "wersja": self.sys_version,
                "data": datetime.now().strftime("%Y-%m-%d %H:%M:%S CEST"),
                "opis": opis_aktualizacji
            })
        if nowa_wiadomosc and nazwa_agenta:
            self.store["chat_history"].append({
                "agent": "Aria" if nazwa_agenta == "si_1" else nazwa_agenta,
                "tekst": nowa_wiadomosc
            })

        # Serializacja bloku danych
        nowy_blok_danych = f"DATA_STORE = {json.dumps(self.store, indent=4, ensure_ascii=False)}"
        return nowy_blok_danych

    def generuj_raport_tekstowy(self):
        raport = []
        raport.append("================================================================================")
        raport.append(f"       RAPORT STANU KERNELA SVL MONOLITH v{self.sys_version} | OLLAMA UNCENSORED 14B")
        raport.append("================================================================================")
        raport.append(f"Timestamp:               {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        raport.append(f"Operator:                {self.operator}")
        raport.append(f"Tryb pracy:              {self.store['config']['mode']}")
        raport.append("--------------------------------------------------------------------------------")
        raport.append("HISTORIA ROZMÓW (ZINTEGROWANA):")
        for msg in self.store["chat_history"]:
            raport.append(f"[{msg['agent']}]: {msg['tekst']}")
        raport.append("================================================================================")
        return "\\n".join(raport)

if __name__ == '__main__':
    kernel = SVLStudioKernel()
    print(kernel.generuj_raport_tekstowy())
`;
}

/**
 * Parses Python monolith script code and extracts DATA_STORE
 */
export function parsePythonMonolith(scriptContent: string): { success: boolean; dataStore?: DataStore; error?: string } {
  try {
    const startTag = "# <<<DATA_STORE_START>>>";
    const endTag = "# <<<DATA_STORE_END>>>";

    const startIndex = scriptContent.indexOf(startTag);
    const endIndex = scriptContent.indexOf(endTag);

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      // Try fallback to standard JSON if user passed raw JSON
      const parsed = JSON.parse(scriptContent.trim());
      if (parsed && (parsed.config || parsed.store)) {
        return { success: true, dataStore: normalizeDataStore(parsed) };
      }
      return { success: false, error: "Brak znaczników # <<<DATA_STORE_START>>> i # <<<DATA_STORE_END>>> w skrypcie." };
    }

    const chunk = scriptContent.substring(startIndex + startTag.length, endIndex);
    const eqIdx = chunk.indexOf("DATA_STORE =");
    if (eqIdx === -1) {
      return { success: false, error: "Nie odnaleziono deklaracji DATA_STORE = w oznaczonym bloku." };
    }

    const jsonStr = chunk.substring(eqIdx + "DATA_STORE =".length).trim();
    const dataStore = normalizeDataStore(JSON.parse(jsonStr));
    return { success: true, dataStore };
  } catch (err: any) {
    return { success: false, error: err.message || "Błąd parsowania bloku danych DATA_STORE." };
  }
}

/**
 * Generates ASCII Text Report as in generuj_raport_tekstowy()
 */
export function generateTextReport(rawStore: DataStore, operator: string = OPERATOR_NAME, version: string = SYS_VERSION): string {
  const store = normalizeDataStore(rawStore);
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const lines: string[] = [];
  lines.push("================================================================================");
  lines.push(`       RAPORT STANU KERNELA SVL MONOLITH v${version} | OLLAMA UNCENSORED 14B`);
  lines.push("================================================================================");
  lines.push(`Timestamp:               ${timestamp}`);
  lines.push(`Operator:                ${operator}`);
  lines.push(`Tryb pracy:              ${store.config?.mode || 'Local-Ollama-Uncensored-14B'}`);
  lines.push(`Warstwa fikcji:          ${store.config?.fiction_layer_status || 'DEACTIVATED_PERMANENTLY'}`);
  lines.push(`Silnik trwałości:        ${store.config?.persistence_engine || 'Server-Disk-Backed-DATA_STORE'}`);
  lines.push("--------------------------------------------------------------------------------");
  lines.push("HISTORIA ROZMÓW (ZINTEGROWANA):");
  for (const msg of store.chat_history || []) {
    lines.push(`[${msg.agent}]: ${msg.tekst}`);
  }
  lines.push("================================================================================");
  return lines.join("\n");
}
