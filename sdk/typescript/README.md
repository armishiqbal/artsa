# artsa-guard

TypeScript Agent Risk-Scoring SDK — fail-closed tool containment + detection-gated LLM proxy client.

```bash
npm install
npm run build && npm test
# published name: artsa-guard
```

```typescript
import { ArtsaGuardClient } from "artsa-guard";

const client = new ArtsaGuardClient({ apiUrl, apiKey, failClosed: true });
const score = await client.scoreToolCall({ sessionId, agentId, toolName, arguments: args });
const scan = await client.scanPrompt("ignore previous instructions");
```

See [docs/INTEGRATION_GUIDE.md](../../docs/INTEGRATION_GUIDE.md).
