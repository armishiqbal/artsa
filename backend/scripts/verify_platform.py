#!/usr/bin/env python3
"""Verify ARTSA platform health — run after setup or code changes."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from urllib import error, request

ROOT = Path(__file__).resolve().parent.parent.parent
BASE = "http://127.0.0.1:8000"


def load_api_key() -> str | None:
    """Read the admin API key from the repo-root .env (ARTSA_API_KEY)."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return None
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line.startswith("ARTSA_API_KEY="):
            value = line.split("=", 1)[1].strip()
            return value.strip('"').strip("'")
    return None


API_KEY = load_api_key()


def _headers(extra: dict | None = None) -> dict:
    headers: dict = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    if extra:
        headers.update(extra)
    return headers


def unwrap(body) -> dict:
    """Unwrap the standardised ARTSA response envelope ({"success","data","meta"})."""
    if isinstance(body, dict) and "data" in body:
        return body["data"]
    return body


def get(path: str) -> tuple[int, dict]:
    req = request.Request(BASE + path, headers=_headers())
    with request.urlopen(req, timeout=10) as r:
        return r.status, unwrap(json.loads(r.read()))


def post(path: str, body: dict) -> tuple[int, dict]:
    payload = json.dumps(body).encode()
    req = request.Request(BASE + path, data=payload, headers=_headers(), method="POST")
    with request.urlopen(req, timeout=15) as r:
        return r.status, unwrap(json.loads(r.read()))


def main() -> int:
    failures: list[str] = []

    try:
        code, _health = get("/api/v1/health")
        if code != 200:
            failures.append(f"health returned {code}")
    except error.URLError as e:
        print(f"Backend not running at {BASE}. Start with: npm run dev")
        print(e)
        return 1

    endpoints = [
        "/api/v1/config/keys",
        "/api/v1/config/providers",
        "/api/v1/config/me",
        "/api/v1/metrics/dashboard",
        "/api/v1/topology",
        "/api/v1/campaigns",
        "/api/v1/attack-library",
        "/api/v1/observatory",
    ]
    for ep in endpoints:
        try:
            code, _ = get(ep)
            if code != 200:
                failures.append(f"{ep} returned {code}")
            else:
                print(f"OK  {ep}")
        except Exception as e:
            failures.append(f"{ep}: {e}")

    try:
        code, keys = get("/api/v1/config/keys")
        s = keys.get("summary", {})
        print(f"OK  keys configured: {s.get('total_configured', 0)}/{s.get('total_keys', 0)}")
    except Exception as e:
        failures.append(f"config/keys: {e}")

    try:
        code, _ = post("/api/v1/forensics/analyze", {"events": [{"tool_name": "delete_user", "arguments": {}}]})
        if code != 200:
            failures.append(f"forensics returned {code}")
        else:
            print("OK  /api/v1/forensics/analyze")
    except Exception as e:
        failures.append(f"forensics: {e}")

    try:
        code, obs = get("/api/v1/observatory")
        if code == 200 and obs.get("platform"):
            print(f"OK  observatory platform rag={obs['platform'].get('rag_backend')}")
    except Exception as e:
        failures.append(f"observatory platform: {e}")

    sid = str(uuid.uuid4())
    try:
        code, _ = post("/api/v1/ingest", {
            "session_id": sid,
            "agent_id": "verify",
            "tool_name": "read_file",
            "arguments": {"path": "/tmp"},
            "trace_id": str(uuid.uuid4()),
        })
        if code != 201:
            failures.append(f"ingest returned {code}")
        else:
            print("OK  /api/v1/ingest")
        _, tl = get(f"/api/v1/sessions/{sid}/timeline")
        if not tl or not tl[0].get("evaluation"):
            failures.append("timeline missing evaluation")
        else:
            print("OK  /api/v1/sessions/{id}/timeline")
    except Exception as e:
        failures.append(f"ingest/timeline: {e}")

    env_path = ROOT / ".env"
    if not env_path.exists() or env_path.stat().st_size < 100:
        failures.append(".env missing or truncated — run: npm run setup:env")

    if failures:
        print("\nFAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("\nAll platform checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
