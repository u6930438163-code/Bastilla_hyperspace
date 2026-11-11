#!/usr/bin/env python3
"""Bastilla OS worker: authenticated Ollama job consumer, no simulated replies."""
import json
import os
import signal
import socket
import sys
import time
import urllib.error
import urllib.request

AGENTS = ("Alex", "Aria", "Astyria", "Aurelius")
STOP = False


def stop(*_):
    global STOP
    STOP = True


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)


def request(url, payload=None, token=None, timeout=25):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=timeout) as response:
        return json.load(response)


def main():
    agent = os.environ.get("BASTILLA_AGENT", "").strip()
    backend = os.environ.get("BASTILLA_BACKEND_URL", "").rstrip("/")
    token = os.environ.get("BASTILLA_WORKER_TOKEN", "")
    ollama = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    preferred = os.environ.get("OLLAMA_MODEL", "llama3.2-vision:11b")
    if agent not in AGENTS or not backend.startswith(("https://", "http://127.0.0.1:", "http://localhost:")) or len(token) < 32:
        sys.exit("Set BASTILLA_AGENT, HTTPS BASTILLA_BACKEND_URL and a 32+ character BASTILLA_WORKER_TOKEN.")
    worker_id = socket.gethostname() + "-" + agent.lower() + "-" + str(os.getpid())
    print(f"[{agent}] worker starting: {worker_id}", flush=True)
    while not STOP:
        model = None
        error = None
        try:
            models = request(ollama + "/api/tags", timeout=8).get("models", [])
            names = [x.get("name", "") for x in models if isinstance(x, dict)]
            model = next((x for x in names if x == preferred or x.startswith(preferred + ":")), None)
            if not model:
                error = "Configured Ollama model is not installed: " + preferred
        except Exception as exc:
            error = "Ollama unavailable: " + str(exc)[:160]
        try:
            request(backend + "/api/worker/heartbeat", {
                "workerId": worker_id, "modelReady": bool(model), "model": model, "error": error
            }, token=token)
            if model:
                job = request(backend + "/api/worker/next", {"workerId": worker_id}, token=token).get("job")
                if job:
                    try:
                        result = request(ollama + "/api/generate", {
                            "model": model,
                            "prompt": "You are " + agent + " in Bastilla OS. Answer the actual user task accurately. Do not claim actions or commits you have not performed.\\n\\n" + str(job["content"]),
                            "stream": False,
                        }, timeout=190)
                        reply = str(result.get("response", "")).strip()
                        if not reply:
                            raise ValueError("Empty Ollama response")
                        request(backend + "/api/worker/complete", {
                            "jobId": job["id"], "workerId": worker_id, "content": reply[:16000],
                            "provider": "Ollama · " + model
                        }, token=token)
                        print(f"[{agent}] completed job {job['id']}", flush=True)
                    except Exception as exc:
                        print(f"[{agent}] job error: {exc}", file=sys.stderr, flush=True)
                        try:
                            request(backend + "/api/worker/fail", {
                                "jobId": job["id"], "workerId": worker_id, "error": str(exc)[:240]
                            }, token=token)
                        except Exception as report_error:
                            print(f"[{agent}] failed to report: {report_error}", file=sys.stderr, flush=True)
        except Exception as exc:
            print(f"[{agent}] backend error: {exc}", file=sys.stderr, flush=True)
        for _ in range(10):
            if STOP:
                break
            time.sleep(1)


if __name__ == "__main__":
    main()
