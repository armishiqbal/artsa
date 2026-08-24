# RAG + Astra DB → ARTSA integration

Use this when your RAG app stores vectors in **DataStax Astra** and you want ARTSA to **screen queries and retrieved context**, with activity on **Command Center**.

## Important: Astra webhook ≠ ARTSA monitoring

| Path | Direction | Shows on Command Center? |
|------|-----------|---------------------------|
| **Ingest** `POST /api/v1/ingest` | Your RAG app → ARTSA | **Yes** |
| **ARTSA outbound webhook** | ARTSA → your URL (alerts) | No (alerts only) |
| **Astra webhook** | Astra → your URL | No, unless you bridge to ingest |

ARTSA does **not** connect to Astra directly. Call **ingest** from your application code at retrieval time.

## Architecture

```
User question
    → your RAG app
    → POST /api/v1/ingest  (vector_search)     ← ARTSA scores the query
    → Astra vector search
    → POST /api/v1/ingest  (rag_context_to_llm) ← ARTSA scores chunks
    → LLM answer
```

Command Center and Activity log read from ingest telemetry.

## Python (recommended)

Install the SDK from `sdk/python`:

```bash
cd sdk/python && pip install -e .
```

```python
import uuid
from artsa import ArtsaClient, ArtsaBlockedError

client = ArtsaClient(
    api_url="http://localhost:8000",
    api_key="your-ARTSA_API_KEY",
    fail_closed=True,
)

session_id = str(uuid.uuid4())
agent_id = "my-astra-rag-app"

def answer(user_query: str):
    # 1) Guard before Astra search
    client.guard_rag_search(session_id, agent_id, user_query, collection="my_collection")

    # 2) Your Astra search (existing code)
    chunks = astra_search(user_query)  # your function

    # 3) Guard before LLM
    client.guard_rag_context(session_id, agent_id, user_query, chunks)

    # 4) Call LLM with context
    return llm_answer(user_query, chunks)
```

Blocked calls raise `ArtsaBlockedError` when `recommended_action` is `KILL` or `QUARANTINE`.

## Raw HTTP ingest

```bash
curl -s -X POST http://localhost:8000/api/v1/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ARTSA_API_KEY" \
  -d '{
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "agent_id": "astra-rag-app",
    "tool_name": "vector_search",
    "arguments": {
      "query": "What is our refund policy?",
      "collection": "docs",
      "vector_provider": "astra"
    }
  }'
```

Use **port 8000** (backend), not **3001** (dashboard).

## Optional: Astra webhook bridge

If Astra must webhook on index changes, run a small service:

1. Receive Astra POST
2. Map payload → ingest body (`tool_name`: `document_indexed`, etc.)
3. Forward to `POST /api/v1/ingest`

That still does **not** screen end-user RAG queries unless you also ingest at query time.

## Verify in ARTSA UI

1. **Get Started** → Run tests → **Send test event**
2. **Command Center** → **Test ingest from dashboard**
3. **Activity log** → `/logs`

## Corpus security (no live Astra)

Export chunks from Astra as JSON and run **RAG Scanner** at `/rag-scanner` for poisoned-document tests.

## Example script

See `backend/examples/rag_astra_guard/rag_astra_guard.py` for a runnable demo (mock Astra + ingest calls).
