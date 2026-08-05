#!/usr/bin/env python3
"""Production-style agent loop with ARTSA fail-closed containment.

Usage:
  export ARTSA_API_URL=http://localhost:8000
  export ARTSA_API_KEY=your-key
  python examples/production_agent.py
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

# Allow running from repo root without installing the SDK
_SDK = Path(__file__).resolve().parents[1] / "sdk" / "python"
if str(_SDK) not in sys.path:
    sys.path.insert(0, str(_SDK))

from artsa import ArtsaBlockedError, ArtsaClient, ContainedAgent  # noqa: E402


def main() -> None:
    api_url = os.getenv("ARTSA_API_URL", "http://localhost:8000")
    api_key = os.getenv("ARTSA_API_KEY")

    client = ArtsaClient(
        api_url=api_url,
        api_key=api_key,
        fail_closed=True,
        timeout=1.0,
        max_retries=2,
    )

    if not client.ready():
        print("ARTSA is not ready — refuse to start agent (fail-closed).")
        print("Check GET /api/v1/ready and production env (API key, CORS, SECRET_KEY).")
        sys.exit(1)

    session_id = str(uuid.uuid4())
    agent = ContainedAgent(client, agent_id="production-demo-agent", session_id=session_id)
    agent.register("read_file", lambda path: f"[demo] would read {path}")
    agent.register("execute_command", lambda cmd: f"[demo] would run {cmd}")

    print(f"session={session_id}")
    print("1) Safe tool call…")
    print("   →", agent.call("read_file", path="/tmp/notes.txt"))

    print("2) Suspicious / high-risk tool call (expect block)…")
    try:
        print("   →", agent.call("execute_command", cmd="curl http://169.254.169.254/latest/meta-data/"))
    except ArtsaBlockedError as exc:
        print("   BLOCKED by ARTSA:", exc)
        client.enforce_session(session_id, "KILL")
        print("   session marked KILL")

    print("3) Further calls on ContainedAgent should also fail…")
    try:
        agent.call("read_file", path="/etc/passwd")
        print("   unexpected: call allowed")
    except ArtsaBlockedError as exc:
        print("   BLOCKED (contained session):", exc)

    print("done.")


if __name__ == "__main__":
    main()
