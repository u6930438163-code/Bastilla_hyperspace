#!/usr/bin/env python3
"""Generate unique credentials for Bastilla workers locally. Never commit output."""
import json
import secrets

agents = ("Alex", "Aria", "Astyria", "Aurelius")
tokens = {agent: secrets.token_urlsafe(48) for agent in agents}
print("SVL_WORKER_TOKENS='" + json.dumps(tokens, separators=(",", ":")) + "'")
print("# Copy the corresponding token into each agent's private BASTILLA_WORKER_TOKEN environment file.")
