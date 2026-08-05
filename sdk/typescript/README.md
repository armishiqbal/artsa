# @artsa/sdk

Fail-closed TypeScript client for ARTSA containment.

```bash
cd sdk/typescript && npm install && npm run build
```

```ts
import { ArtsaClient, ArtsaBlockedError } from "@artsa/sdk";

const client = new ArtsaClient({
  apiUrl: process.env.ARTSA_API_URL,
  apiKey: process.env.ARTSA_API_KEY,
  failClosed: true, // default
});

await client.guardToolCall({
  sessionId,
  agentId: "node-agent",
  toolName: "read_file",
  arguments: { path: "/tmp/x" },
});
```

See [docs/INTEGRATION_GUIDE.md](../../docs/INTEGRATION_GUIDE.md).
