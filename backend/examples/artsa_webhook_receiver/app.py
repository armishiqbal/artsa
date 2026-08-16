"""ARTSA webhook receiver — accept custom-connector events and view them.

Streamlit apps (and many other frontends) can't receive POST webhooks, so ARTSA
connectors should target an HTTP/JSON endpoint like THIS one. It stores every
event it receives and serves them back for viewing or for your app to read.

Endpoints
    POST /webhook      ARTSA connector target (any JSON event)
    GET  /             HTML viewer — last 50 events in the browser
    GET  /api/events   JSON list of events (use from your Streamlit app)
    GET  /health       health check

Optional auth
    Set WEBHOOK_TOKEN to require a bearer token. Create the ARTSA connector
    with ``auth_type: bearer`` and a secret named ``token`` set to the same
    value — ARTSA will then send ``Authorization: Bearer <token>`` on every
    delivery, which this receiver checks (X-API-Key is accepted too).

Run
    pip install fastapi uvicorn
    WEBHOOK_TOKEN=<set-in-shell> uvicorn app:app --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import UTC, datetime

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import HTMLResponse

DB_PATH = os.environ.get("WEBHOOK_DB", "artsa_events.db")
WEBHOOK_TOKEN = os.environ.get("WEBHOOK_TOKEN", "")

app = FastAPI(title="ARTSA Webhook Receiver")
_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            received_at TEXT NOT NULL,
            event_type  TEXT,
            severity    TEXT,
            risk_score  REAL,
            payload     TEXT NOT NULL
        )
        """
    )
    return conn


def _authorized(authorization: str | None, x_api_key: str | None) -> bool:
    if not WEBHOOK_TOKEN:
        return True
    if x_api_key and x_api_key == WEBHOOK_TOKEN:
        return True
    if authorization and authorization.startswith("Bearer "):
        return authorization[len("Bearer ") :] == WEBHOOK_TOKEN
    return False


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/webhook")
async def webhook(
    request: Request,
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> dict:
    """ARTSA connector target — store one JSON event."""
    if not _authorized(authorization, x_api_key):
        raise HTTPException(status_code=401, detail="invalid or missing bearer token")

    payload = await request.json()
    data = payload if isinstance(payload, dict) else {"payload": payload}
    event_type = str(data.get("type") or data.get("event_type") or "unknown")
    severity = str(data.get("severity") or "") or None
    try:
        risk = float(data.get("risk_score") or 0.0)
    except (TypeError, ValueError):
        risk = None

    with _lock:
        conn = _connect()
        try:
            cur = conn.execute(
                "INSERT INTO events (received_at, event_type, severity, risk_score, payload) "
                "VALUES (?, ?, ?, ?, ?)",
                (datetime.now(UTC).isoformat(), event_type, severity, risk,
                 json.dumps(data)),
            )
            conn.commit()
            total = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
        finally:
            conn.close()
    return {"status": "ok", "event_type": event_type, "received": total}


@app.get("/api/events")
def events(limit: int = 100) -> dict:
    """Latest events as JSON — poll this from your Streamlit app."""
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM events ORDER BY id DESC LIMIT ?", (max(1, min(limit, 1000)),)
        ).fetchall()
        return {
            "events": [
                {
                    "id": r["id"],
                    "received_at": r["received_at"],
                    "event_type": r["event_type"],
                    "severity": r["severity"],
                    "risk_score": r["risk_score"],
                    "payload": json.loads(r["payload"]),
                }
                for r in rows
            ]
        }
    finally:
        conn.close()


@app.get("/", response_class=HTMLResponse)
def viewer() -> str:
    """Simple browser page showing the last 50 events."""
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM events ORDER BY id DESC LIMIT 50"
        ).fetchall()
    finally:
        conn.close()

    cards = []
    for r in rows:
        risk = f"{r['risk_score']:.1f}" if r["risk_score"] is not None else "—"
        sev = r["severity"] or "—"
        cards.append(
            f"""
            <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:8px">
              <div style="display:flex;gap:16px;align-items:center;margin-bottom:6px">
                <span style="font-family:monospace;font-size:12px;color:#64748b">#{r['id']}</span>
                <strong>{r['event_type']}</strong>
                <span style="font-family:monospace;font-size:12px;color:#64748b">{sev}</span>
                <span style="font-family:monospace;font-size:12px;color:#64748b">risk {risk}</span>
                <span style="margin-left:auto;font-family:monospace;font-size:11px;color:#94a3b8">{r['received_at']}</span>
              </div>
              <pre style="margin:0;font-size:12px;white-space:pre-wrap;color:#334155">{json.dumps(json.loads(r['payload']), indent=2)}</pre>
            </div>
            """
        )
    body = "".join(cards) or "<p style='color:#94a3b8'>No events yet — create an ARTSA connector targeting /webhook.</p>"
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>ARTSA Webhook Receiver</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;background:#f8fafc">
  <h1 style="font-size:20px">📡 ARTSA Webhook Receiver</h1>
  <p style="color:#64748b;margin-top:0">Point your Custom Outbound connector at <code>/webhook</code>.</p>
  {body}
</body></html>"""
