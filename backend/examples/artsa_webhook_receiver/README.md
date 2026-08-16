# 📡 ARTSA Webhook Receiver

A tiny, dependency-light FastAPI app that **receives ARTSA custom-connector
events and stores them** so any frontend can read them back. This is the piece
that bridges ARTSA to apps that can't receive POSTs themselves — like your
Streamlit Community Cloud app.

```
ARTSA (Custom Outbound connector)  ──POST /webhook──►  This receiver  ──GET /api/events──►  Your app
```

## Why this exists

Your Streamlit app URL (`*.streamlit.app`) can't be a connector target: Streamlit
runs a UI, not a REST API — its internal channel is WebSockets, and when the app
has auth enabled it redirects everything to a sign-in page. No JSON POST lands.

So instead: **ARTSA → this receiver → your app reads events**. You deploy the
receiver once (free tier of any host), point an ARTSA connector at
`https://your-receiver/webhook`, and your Streamlit app polls `/api/events`.

## Run it locally

```bash
cd backend/examples/artsa_webhook_receiver
pip install -r requirements.txt
WEBHOOK_TOKEN=<set-in-shell> uvicorn app:app --host 0.0.0.0 --port 8001
```

> `WEBHOOK_TOKEN` is optional. Set it and only requests with
> `Authorization: Bearer <token>` (or `X-API-Key: <token>`) are accepted.

## Endpoints

| Method | Path          | Purpose                                        |
|--------|---------------|------------------------------------------------|
| POST   | `/webhook`    | ARTSA connector target — stores one event      |
| GET    | `/`           | Browser viewer — last 50 events (prettified)   |
| GET    | `/api/events` | JSON list of latest events (for your app)      |
| GET    | `/health`     | Health check                                   |

## Connect ARTSA to it

In ARTSA **Settings → Integrations → Custom Outbound → New Connector**:

- **Target URL**: `https://your-receiver.example.com/webhook`
- **Auth**: `Bearer` with secret `token` = your `WEBHOOK_TOKEN`
- **Method**: `POST`
- **Event types**: check the ones you care about (e.g. `alert`)
- **Risk threshold**: `0` to receive everything

Then hit **Test** — the sample alert lands in the receiver immediately.

## Your Streamlit app reads the events

```python
import streamlit as st
import requests
import pandas as pd

RECEIVER = "https://your-receiver.example.com"

@st.cache_data(ttl=10)
def fetch_events():
    return requests.get(f"{RECEIVER}/api/events?limit=100", timeout=5).json()["events"]

st.title("🛡️ ARTSA events")
events = fetch_events()
if not events:
    st.info("No events yet — create an ARTSA connector targeting /webhook.")
else:
    st.dataframe(
        pd.DataFrame([
            {
                "received_at": e["received_at"],
                "type": e["event_type"],
                "severity": e["severity"],
                "risk_score": e["risk_score"],
            }
            for e in events
        ])
    )
    with st.expander("Raw payloads"):
        st.json([e["payload"] for e in events])
```

## Deploy options (free)

- **Render**: new *Web Service* → repo/this folder, build `pip install -r requirements.txt`, start `uvicorn app:app --host 0.0.0.0 --port 8001`. Add `WEBHOOK_TOKEN` in *Environment*.
- **Railway / Fly.io**: same command, set the env var in the dashboard.
- **Replit / Python Anywhere**: run the same `uvicorn` command on a public port.

Give the receiver a **public HTTPS URL** — ARTSA will POST to it from your
backend, so `localhost:8001` only works while both run on the same machine.
