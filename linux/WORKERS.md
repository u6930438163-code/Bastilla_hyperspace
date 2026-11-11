# Bastilla OS — rzeczywiste workery Ollama (Debian 13)

Backend uruchamia API; **nie** uruchamia workerów na Firebase Hosting. Workery działają jako osobne usługi systemd na hoście Debian 13 z dostępem do Ollama.

## Konfiguracja serwera

Ustaw `SVL_WORKER_TOKENS` w prywatnym środowisku backendu jako JSON z czterema różnymi losowymi tokenami (minimum 32 znaki każdy), np. mapę kluczy `Alex`, `Aria`, `Astyria`, `Aurelius`. Nigdy nie commituj wartości.

## Instalacja na własnym Debianie 13

1. Umieść kod repozytorium w `/opt/bastilla`, z dostępem do `linux/bastilla-ollama-worker.py`.
2. Utwórz konta systemowe `bastilla-Alex`, `bastilla-Aria`, `bastilla-Astyria`, `bastilla-Aurelius` (lub zmień nazwy w jednostce).
3. Umieść `linux/bastilla-worker@.service` w `/etc/systemd/system/`.
4. Dla każdego agenta utwórz prywatny plik `/etc/bastilla/workers/<Agent>.env` z:
   - `BASTILLA_BACKEND_URL=https://twoj-backend.example`
   - `BASTILLA_WORKER_TOKEN=<unikalny token tego agenta>`
   - `OLLAMA_BASE_URL=http://127.0.0.1:11434`
   - `OLLAMA_MODEL=<nazwa modelu z ollama list>`
5. Nadaj plikom env uprawnienia 0600 i właściciela root, upewnij się, że systemd może je odczytać.
6. `sudo systemctl daemon-reload`; uruchom np. `sudo systemctl enable --now bastilla-worker@Alex` i analogicznie pozostałych.
7. Weryfikuj `sudo journalctl -u bastilla-worker@Alex -n 100 --no-pager`, `/api/agents/activity` i odpowiedzi na zadania w czacie.

**Uwaga:** endpoint `/api/agents/activity` wymaga autoryzacji operatora. Status ONLINE jest oparty na heartbeat, a nie na samym istnieniu usługi. Workery nie mają dostępu root, GitHub ani powłoki: tylko pobierają zadania tekstowe i zwracają odpowiedzi Ollama. Dostęp do narzędzi systemowych i zapisów GitHub wymaga osobnego, kontrolowanego mechanizmu.

**Ograniczenia:** Worker obecnie nie odświeża dzierżawy podczas generacji; zadania Ollama trwające ponad 240 sekund mogą utracić dzierżawę. Timeout generacji ustawiono na 190 sekund. W przypadku utraty połączenia wynik może zostać odrzucony przez backend. Plik nie był uruchomiony na rzeczywistym hoście w ramach tego commitu.
