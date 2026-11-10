# Bastilla Hyperspace — Ollama i workery

Po synchronizacji commit main i restarcie backendu uruchamiane są cztery lokalne procesy workerów.
Każdy worker zgłasza heartbeat co 12 s i osobno potwierdza modelReady po rzeczywistym GET /api/tags.
Wiadomość skierowana do konkretnego agenta jest generowana przez POST /api/chat, a nie z szablonu.
Jeśli model nie działa, zadanie otrzymuje status failed i komunikat diagnostyczny.

## Konfiguracja serwera

- OLLAMA_BASE_URL: osiągalny z kontenera backendu adres Ollamy. 127.0.0.1 oznacza **ten sam kontener**, nie komputer operatora.
- OLLAMA_MODEL=auto wybiera zainstalowany model vision 11B, jeśli istnieje, albo pierwszy dostępny.
- SVL_START_WORKERS=true uruchamia procesy Alex, Aria, Astyria, Aurelius.
- SVL_WORKER_TOKENS: cztery prywatne unikalne tokeny JSON wyłącznie dla oddzielnych workerów. Puste pole powoduje wygenerowanie losowych tokenów dla lokalnych procesów.
- SVL_START_CONTAINER_OBSERVER=false: domyślnie nie udawaj, że środowisko AI Studio jest hostem Debian.
- SVL_ALLOW_OLLAMA_FALLBACK=true: jeżeli OpenCode offline, czat Wszyscy może użyć Ollamy, pokazując rzeczywistego dostawcę.

## Ograniczenia

Zewnętrzny Debian musi wysyłać pomiary przez linux/linux-sync-agent.py z osobnym sekretem SVL_LINUX_SYNC_TOKEN.
Nie wystawiaj publicznie portu Ollamy 11434; dla zdalnej Ollamy użyj prywatnego, uwierzytelnionego HTTPS/tunelu.
Bez rzeczywistego serwera Ollama w zasięgu kontenera system pokaże OFFLINE. Commit nie uruchamia Ollamy automatycznie.

Minimalne testy: npm ci, npm test, npm run check, npm run build. API /api/health raportuje gotowość modeli osobno od heartbeat workerów.
