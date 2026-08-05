# artsa-sdk

Python SDK for live ARTSA containment — wrap agent tools so every call is scored and optionally blocked before execution.

```bash
pip install -e .
```

```python
from artsa import ArtsaClient, guarded_tool, LangChainContainmentCallback, wrap_openai_tools

client = ArtsaClient(api_url="http://localhost:8000", api_key="...", fail_closed=True)

@guarded_tool(client, agent_id="my-agent")
def search(query: str) -> str:
    ...
```

See [docs/INTEGRATION_GUIDE.md](../../docs/INTEGRATION_GUIDE.md) for all integration patterns (HTTP, LangChain, OpenAI tools, MCP, OTEL, CI).

**Default is fail-closed** (`fail_closed=True`). Set `ARTSA_FAIL_CLOSED=false` only for demos.
