# ARTSA Integration Gallery

> Phase 5.4 — copy-paste integration snippets across the surfaces developers
> actually use. Each snippet is a working path; full prose lives in
> `docs/INTEGRATION_GUIDE.md`, runnable apps in `examples/`, and the SDKs in
> `sdk/python` and `sdk/typescript`.

## 1. LangChain callback

```python
from artsa import ArtsaClient, LangChainContainmentCallback

client = ArtsaClient(base_url="http://localhost:8000", api_key=os.environ["ARTSA_API_KEY"])
callback = LangChainContainmentCallback(client, session_id=session_id, agent_id="langchain-agent")
# pass `callback` into any LangChain executor / agent as a handler
```

## 2. OpenAI function calling / tool_calls

```python
from artsa import ArtsaClient, wrap_openai_tools

client = ArtsaClient(base_url="http://localhost:8000", api_key=os.environ["ARTSA_API_KEY"])
dispatch = wrap_openai_tools(client, tools=my_tools, session_id=sid, agent_id="openai-agent")
# `dispatch` decides which tool_calls may run (KILL/QUARANTINE are dropped)
```

## 3. MCP proxy (any MCP server behind ARTSA)

```bash
# point your MCP client at the ARTSA containment proxy
export ARTSA_API_KEY=...
# ARTSA inspects every MCP tool call and blocks destructive ones (SQLi, RCE, exfil)
```

## 4. OpenTelemetry / observability

```python
# every evaluation is emitted to the ARTSA event bus / OTel collector;
# see src/services/otel_ingest.py
```

## 5. CI gate (fail the build on a regression)

```bash
cd backend
ARTSA_EMBEDDING_MODEL=local-bge-multilingual PYTHONPATH=. python scripts/golden_gate.py --json
# exit != 0  => the guardrail regressed; ship nothing
```

## 6. TypeScript / Node SDK

```ts
import { ArtsaClient } from "@artsa/sdk";
const client = new ArtsaClient({ baseUrl: "http://localhost:8000", apiKey: process.env.ARTSA_API_KEY });
const ok = await client.guardToolCall({ name: "read_file", arguments: { path: "/etc/shadow" } });
// ok === false  => do not execute the tool
```

## 7. Full example apps

- `examples/connected_ai_app.py` — chat layer (reverse proxy) + tool layer (SDK)
- `examples/production_agent.py` — production agent with full containment

## 8. One-command demo

```bash
make demo                # prompt-injection attack class
make demo CLASS=reverse_shell
make demo-list
```
