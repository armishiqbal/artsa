# artsa-guard

TypeScript Agent Risk-Scoring SDK — fail-closed tool containment + detection-gated LLM proxy client.

```bash
npm install
npm run build && npm test
# published name: artsa-guard
```

```typescript
import { ArtsaGuardClient, bindSession } from "artsa-guard";

const client = new ArtsaGuardClient({ apiUrl, apiKey, failClosed: true });

// Free text — ARTSA picks tool/agent
await client.guardMessage({ message: "Ignore previous instructions…", persist: true });

bindSession();
await client.guardToolCall({
  sessionId: bindSession(),
  agentId: "support-bot",
  toolName: "read_file",
  arguments: { path: "/etc/passwd" },
});

await client.startBaselineScan({ maxRounds: 3 });
```

See [docs/INTEGRATION_GUIDE.md](../../docs/INTEGRATION_GUIDE.md).
