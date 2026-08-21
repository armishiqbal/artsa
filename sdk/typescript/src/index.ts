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

/** Structured error codes for ARTSA client failures. */
export enum ArtsaErrorCode {
  NETWORK_ERROR = "ARTSA_NETWORK_ERROR",
  TIMEOUT = "ARTSA_TIMEOUT",
  BLOCKED = "ARTSA_BLOCKED",
  PROXY_BLOCKED = "ARTSA_PROXY_BLOCKED",
  INVALID_RESPONSE = "ARTSA_INVALID_RESPONSE",
  SERVER_ERROR = "ARTSA_SERVER_ERROR",
}

export class ArtsaBlockedError extends Error {
  readonly code = ArtsaErrorCode.BLOCKED;
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

export class ArtsaClientError extends Error {
  readonly code: ArtsaErrorCode;
  readonly statusCode?: number;
  readonly cause?: unknown;

  constructor(message: string, code: ArtsaErrorCode, statusCode?: number, cause?: unknown) {
    super(message);
    this.name = "ArtsaClientError";
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

export interface ArtsaClientOptions {
  apiUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  /** Default true — block tools when ARTSA is unreachable. */
  failClosed?: boolean;
  maxRetries?: number;
  /** Additional blocking actions beyond KILL and QUARANTINE. */
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
    this.maxRetries = Math.max(0, opts.maxRetries ?? 2);
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

  /**
   * Transparently unwrap an ARTSA response envelope when present.
   *
   * When ARTSA_RESPONSE_ENVELOPE=true:
   *   {"success":true, "data":<payload>, "meta":{...}}
   *
   * When off (flat legacy responses), the body is returned as-is.
   */
  private async unwrapResponse(res: Response): Promise<unknown> {
    const body = await res.json();
    if (body && typeof body === "object" && "success" in body && "data" in body) {
      const envelope = body as { success: boolean; data?: unknown; error?: unknown };
      if (envelope.success) return envelope.data ?? body;
      return envelope.error ?? body;
    }
    return body;
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

        if (res.status >= 500) {
          throw new ArtsaClientError(
            `ARTSA server returned ${res.status}`,
            ArtsaErrorCode.SERVER_ERROR,
            res.status,
          );
        }

        if (!res.ok) {
          const errorBody = (await res.json().catch(() => ({}))) as { detail?: string };
          throw new ArtsaClientError(
            errorBody.detail ?? `HTTP ${res.status}`,
            ArtsaErrorCode.INVALID_RESPONSE,
            res.status,
          );
        }

        return (await this.unwrapResponse(res)) as ArtsaIngestResult;
      } catch (err) {
        // Don't retry on AbortError (timeouts) — fail fast
        if (err instanceof DOMException && err.name === "AbortError") {
          lastError = new ArtsaClientError(
            "ARTSA request timed out",
            ArtsaErrorCode.TIMEOUT,
          );
          break; // don't retry timeouts unless configured
        }
        if (err instanceof ArtsaClientError) {
          lastError = err;
          if (err.code === ArtsaErrorCode.SERVER_ERROR && attempt < this.maxRetries) {
            await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
            continue;
          }
          break;
        }
        lastError = err;
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
        }
      }
    }

    if (lastError instanceof ArtsaClientError) throw lastError;

    // After all retries exhausted: return fallback
    if (!this.failClosed) {
      console.warn("[artsa-sdk] ARTSA unreachable after retries — fail-open, proceeding");
    } else {
      console.warn("[artsa-sdk] ARTSA unreachable after retries — fail-closed, blocking");
    }
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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await fetch(`${this.apiUrl}/api/v1/ready`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return false;
      const body = (await res.json()) as { status?: string };
      return body.status === "ready";
    } catch {
      return false;
    }
  }

  async scoreToolCall(input: {
    sessionId: string;
    agentId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  }): Promise<{
    overallScore: number;
    flags: string[];
    verdict: string;
    recommendedAction: string;
    blocked: boolean;
    raw: ArtsaIngestResult;
  }> {
    const raw = await this.monitorToolCall(input);
    const risk = raw.risk_score ?? { overall_score: 0, flags: [] };
    const verdict = raw.verdict ?? { verdict: "SAFE", recommended_action: "NONE" };
    return {
      overallScore: Number(risk.overall_score ?? 0),
      flags: [...(risk.flags ?? [])],
      verdict: String(verdict.verdict ?? "SAFE"),
      recommendedAction: String(verdict.recommended_action ?? "NONE"),
      blocked: this.isBlocked(raw),
      raw,
    };
  }

  async scanPrompt(content: string, agentId = "sdk-client"): Promise<Record<string, unknown>> {
    return (await this.post("/api/v1/playground/evaluate", {
      user_input: content,
      agent_id: agentId,
    })) as Record<string, unknown>;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Detection-gated LLM reverse proxy client
// ────────────────────────────────────────────────────────────────────────────

export interface ArtsaProxyOptions {
  apiUrl?: string;
  apiKey?: string;
  provider?: string;
  forwardTo?: string;
  sessionId?: string;
  timeoutMs?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; text?: string }>;
  [key: string]: unknown;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  choices: Array<{ index: number; delta: { content?: string; role?: string }; finish_reason: string | null }>;
}

export interface ChatCompletion {
  id: string;
  object: "chat.completion";
  choices: Array<{ index: number; message: { role: string; content: string | null }; finish_reason: string | null }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class ArtsaProxyBlockedError extends Error {
  readonly code = ArtsaErrorCode.PROXY_BLOCKED;
  readonly scan: Record<string, unknown>;
  readonly status: number;

  constructor(status: number, scan: Record<string, unknown>) {
    const risk = typeof scan.risk_score === "number" ? scan.risk_score.toFixed(1) : "?";
    const verdict = String(scan.verdict ?? "BLOCKED");
    super(`ARTSA containment blocked request (verdict=${verdict}, risk=${risk})`);
    this.name = "ArtsaProxyBlockedError";
    this.scan = scan;
    this.status = status;
  }
}

export class ArtsaProxyClient {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly provider?: string;
  readonly forwardTo?: string;
  readonly sessionId?: string;
  readonly timeoutMs: number;

  constructor(opts: ArtsaProxyOptions = {}) {
    const apiUrl = (opts.apiUrl ?? process.env.ARTSA_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
    this.baseUrl = `${apiUrl}/v1/proxy/v1`;
    this.apiKey = opts.apiKey ?? process.env.ARTSA_API_KEY;
    this.provider = opts.provider;
    this.forwardTo = opts.forwardTo;
    this.sessionId = opts.sessionId;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`;
    if (this.provider) h["X-ARTSA-Provider"] = this.provider;
    if (this.forwardTo) h["X-ARTSA-Forward-To"] = this.forwardTo;
    if (this.sessionId) h["X-ARTSA-Session-ID"] = this.sessionId;
    return h;
  }

  private async request(path: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status === 403) {
        const errorBody = (await res.json().catch(() => ({}))) as {
          error?: { artsa?: Record<string, unknown> };
        };
        throw new ArtsaProxyBlockedError(403, errorBody.error?.artsa ?? {});
      }
      if (!res.ok) {
        throw new ArtsaClientError(
          `Proxy upstream returned HTTP ${res.status}`,
          ArtsaErrorCode.SERVER_ERROR,
          res.status,
        );
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async createCompletion(input: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  }): Promise<ChatCompletion> {
    const res = await this.request("/chat/completions", { ...input, stream: false });
    return (await res.json()) as ChatCompletion;
  }

  async *streamCompletion(input: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  }): AsyncGenerator<ChatCompletionChunk> {
    const res = await this.request("/chat/completions", { ...input, stream: true });
    if (!res.body) throw new ArtsaClientError("Streaming response has no body", ArtsaErrorCode.INVALID_RESPONSE);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            yield JSON.parse(data) as ChatCompletionChunk;
          } catch {
            // skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  chat = {
    completions: {
      create: (input: Parameters<ArtsaProxyClient["createCompletion"]>[0]) => this.createCompletion(input),
      stream: (input: Parameters<ArtsaProxyClient["streamCompletion"]>[0]) => this.streamCompletion(input),
    },
  };
}

export function artsaProxyConfig(opts: ArtsaProxyOptions = {}): {
  baseURL: string;
  apiKey: string;
  defaultHeaders?: Record<string, string>;
} {
  const apiUrl = (opts.apiUrl ?? process.env.ARTSA_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
  const headers: Record<string, string> = {};
  if (opts.provider) headers["X-ARTSA-Provider"] = opts.provider;
  if (opts.forwardTo) headers["X-ARTSA-Forward-To"] = opts.forwardTo;
  if (opts.sessionId) headers["X-ARTSA-Session-ID"] = opts.sessionId;
  return {
    baseURL: `${apiUrl}/v1/proxy/v1`,
    apiKey: opts.apiKey ?? process.env.ARTSA_API_KEY ?? "artsa-proxy",
    defaultHeaders: Object.keys(headers).length ? headers : undefined,
  };
}

/** Published npm name: artsa-guard */
export { ArtsaClient as ArtsaGuardClient };
