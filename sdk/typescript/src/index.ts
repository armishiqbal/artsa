/**
 * ARTSA TypeScript / Node SDK — fail-closed tool containment client.
 *
 * Usage:
 *   import { ArtsaClient } from "@artsa/sdk";
 *   const client = new ArtsaClient({ apiUrl, apiKey, failClosed: true });
 *   await client.guardToolCall({ sessionId, agentId, toolName, arguments });
 */

export type RecommendedAction = "NONE" | "ALERT" | "THROTTLE" | "KILL" | "QUARANTINE";

export interface ArtsaVerdict {
  verdict: string;
  recommended_action: RecommendedAction | string;
  reasoning?: string;
  confidence?: number;
}

export interface ArtsaIngestResult {
  ingested?: number;
  session_id?: string;
  risk_score?: { overall_score: number; flags?: string[] };
  verdict?: ArtsaVerdict;
  session_status?: string;
  evaluations?: unknown[];
  auto_enforced_action?: string | null;
}

export class ArtsaBlockedError extends Error {
  readonly toolName: string;
  readonly result: ArtsaIngestResult;

  constructor(toolName: string, result: ArtsaIngestResult) {
    const reasoning = result.verdict?.reasoning ?? "containment policy";
    super(`ARTSA blocked tool '${toolName}': ${reasoning}`);
    this.name = "ArtsaBlockedError";
    this.toolName = toolName;
    this.result = result;
  }
}

export interface ArtsaClientOptions {
  apiUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  /** Default true — block tools when ARTSA is unreachable. */
  failClosed?: boolean;
  maxRetries?: number;
  blockActions?: string[];
}

const BLOCKING = new Set(["KILL", "QUARANTINE"]);
const CONTAINED = new Set(["BREACHED", "QUARANTINED", "CLOSED"]);

function envFailClosed(fallback: boolean): boolean {
  const raw = process.env.ARTSA_FAIL_CLOSED;
  if (raw === undefined) return fallback;
  return ["1", "true", "yes"].includes(raw.trim().toLowerCase());
}

export class ArtsaClient {
  readonly apiUrl: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  readonly failClosed: boolean;
  readonly maxRetries: number;
  readonly blockActions: Set<string>;

  constructor(opts: ArtsaClientOptions = {}) {
    this.apiUrl = (opts.apiUrl ?? process.env.ARTSA_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
    this.apiKey = opts.apiKey ?? process.env.ARTSA_API_KEY;
    this.timeoutMs = opts.timeoutMs ?? 500;
    this.failClosed = envFailClosed(opts.failClosed ?? true);
    this.maxRetries = opts.maxRetries ?? 2;
    this.blockActions = new Set((opts.blockActions ?? [...BLOCKING]).map((a) => a.toUpperCase()));
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      h.Authorization = `Bearer ${this.apiKey}`;
      h["X-API-Key"] = this.apiKey;
    }
    return h;
  }

  private fallback(): ArtsaIngestResult {
    if (this.failClosed) {
      return {
        verdict: {
          verdict: "BREACHED",
          recommended_action: "KILL",
          reasoning: "ARTSA unreachable (fail-closed)",
          confidence: 0,
        },
        risk_score: { overall_score: 100, flags: [] },
        session_status: "BREACHED",
      };
    }
    return {
      verdict: {
        verdict: "SAFE",
        recommended_action: "NONE",
        reasoning: "ARTSA unreachable (fail-open)",
        confidence: 0,
      },
      risk_score: { overall_score: 0, flags: [] },
    };
  }

  private async post(path: string, body: unknown): Promise<ArtsaIngestResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const res = await fetch(`${this.apiUrl}${path}`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.status === 403) {
          const detail = (await res.json().catch(() => ({}))) as {
            detail?: { message?: string; session_status?: string };
          };
          const d = detail.detail ?? {};
          return {
            verdict: {
              verdict: "BREACHED",
              recommended_action: "KILL",
              reasoning: d.message ?? "session contained",
              confidence: 1,
            },
            risk_score: { overall_score: 100, flags: ["session_contained"] },
            session_status: d.session_status ?? "BREACHED",
          };
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ArtsaIngestResult;
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
        }
      }
    }
    void lastError;
    return this.fallback();
  }

  isBlocked(result: ArtsaIngestResult): boolean {
    const action = String(result.verdict?.recommended_action ?? "NONE").toUpperCase();
    if (this.blockActions.has(action)) return true;
    const status = String(result.session_status ?? "").toUpperCase();
    return CONTAINED.has(status);
  }

  async monitorToolCall(input: {
    sessionId: string;
    agentId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    eventId?: string;
    traceId?: string;
  }): Promise<ArtsaIngestResult> {
    return this.post("/api/v1/ingest", {
      id: input.eventId ?? crypto.randomUUID(),
      session_id: input.sessionId,
      agent_id: input.agentId,
      tool_name: input.toolName,
      arguments: input.arguments,
      trace_id: input.traceId ?? crypto.randomUUID(),
    });
  }

  async guardToolCall(
    input: {
      sessionId: string;
      agentId: string;
      toolName: string;
      arguments: Record<string, unknown>;
    },
    enforce = true
  ): Promise<ArtsaIngestResult> {
    const result = await this.monitorToolCall(input);
    if (enforce && this.isBlocked(result)) {
      throw new ArtsaBlockedError(input.toolName, result);
    }
    return result;
  }

  async enforceSession(sessionId: string, action: RecommendedAction = "KILL"): Promise<ArtsaIngestResult> {
    return this.post(`/api/v1/sessions/${sessionId}/action`, { action });
  }

  async ready(): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiUrl}/api/v1/ready`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as { status?: string };
      return body.status === "ready";
    } catch {
      return false;
    }
  }
}
