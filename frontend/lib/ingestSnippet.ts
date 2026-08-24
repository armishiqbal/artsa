/** Shared ingest endpoint URL and copy-paste curl for wiring agents. */

export function ingestApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return "http://localhost:8000";
}

export function buildIngestCurlSnippet(options?: {
  sessionId?: string;
  agentId?: string;
  toolName?: string;
  argumentsJson?: string;
}): string {
  const base = ingestApiBaseUrl();
  const sessionId = options?.sessionId ?? "sess-demo-001";
  const agentId = options?.agentId ?? "agent-support";
  const toolName = options?.toolName ?? "read_file";
  const args = options?.argumentsJson ?? '{ "path": "/etc/passwd" }';

  return `curl -s -X POST ${base}/api/v1/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: $ARTSA_API_KEY" \\
  -d '{
    "session_id": "${sessionId}",
    "agent_id": "${agentId}",
    "tool_name": "${toolName}",
    "arguments": ${args}
  }'`;
}

export async function copyIngestCurl(options?: Parameters<typeof buildIngestCurlSnippet>[0]): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(buildIngestCurlSnippet(options));
    const { toast } = await import("@/lib/stores/toast");
    toast("Ingest curl copied", { description: "Paste in terminal — set ARTSA_API_KEY first", variant: "success" });
    return true;
  } catch {
    return false;
  }
}
