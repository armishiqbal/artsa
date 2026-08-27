/**
 * HTTP client for the unified ARTSA API (containment + wargame + library on port 8000).
 *
 * Response envelope migration (A6):
 *   When the backend has ARTSA_RESPONSE_ENVELOPE=true, all JSON responses are
 *   wrapped as {"success":bool, "data":<payload>, "meta":{...}}.
 *   This client transparently unwraps so callers always receive the inner payload.
 */

import { toast } from "@/lib/stores/toast";
import { API_UNAVAILABLE } from "@/lib/getStartedLabels";
import { getApiKey, getBearerToken, useAuthStore } from "@/lib/stores/auth";
import { useTenantStore } from "@/lib/stores/tenant";

const API_BASE_URL = "/api/backend";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

function isOfflinePreviewToken(token: string | null): boolean {
  return token === "demo_preview_token" || Boolean(token?.startsWith("admin_token_"));
}

/** Port of the configured backend base URL, used in connectivity error messages.
 * Falls back to 8000 when the base URL is unset or unparseable. */
function backendPort(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE_URL;
  try {
    const { port, protocol } = new URL(base);
    return port || (protocol === "https:" ? "443" : "80");
  } catch {
    return "8000";
  }
}

/**
 * Auth-only headers (X-API-Key or session Bearer) with no Content-Type, so the
 * browser sets its own where required (e.g. the multipart boundary on FormData).
 */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = getApiKey();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  } else {
    const bearer = getBearerToken();
    if (bearer && !isOfflinePreviewToken(bearer)) {
      headers["Authorization"] = `Bearer ${bearer}`;
    }
  }
  return headers;
}

export function buildHeaders(extra?: HeadersInit): HeadersInit {
  // WS-3.1: every request is scoped to the active tenant (X-Tenant-ID), so the
  // backend's row-level isolation applies to the whole UI.
  let tenantId = "default_org";
  try {
    tenantId = useTenantStore.getState().tenantId || "default_org";
  } catch {
    // SSR / pre-hydration: keep the default.
  }
  return {
    "Content-Type": "application/json",
    "X-Tenant-ID": tenantId,
    ...authHeaders(),
    ...(extra as Record<string, string> | undefined),
  };
}

/**
 * Unwrap a JSON response body from the standardised ARTSA envelope.
 *
 * When ARTSA_RESPONSE_ENVELOPE=true:
 *   Successful: {"success":true, "data":<original>, "meta":{...}}
 *   Error:      {"success":false, "error":{...}, "meta":{...}}
 *
 * When the flag is off or the endpoint is excluded (health/ready/proxy/ws):
 *   The raw payload is returned as-is.
 *
 * This function handles both shapes transparently.
 */
export function unwrapEnvelope(body: unknown): unknown {
  if (!body || typeof body !== "object" || !("success" in body)) {
    return body;
  }
  const envelope = body as { success: boolean; data?: unknown; error?: unknown };
  if (envelope.success) {
    return envelope.data ?? body;
  }
  const err = envelope.error;
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    if (typeof record.message === "string" && record.detail == null) {
      return { ...record, detail: record.message };
    }
    return err;
  }
  return body;
}

export interface FetchOptions extends RequestInit {
  /** Suppress error toasts (for background polling) */
  silent?: boolean;
  /** Request timeout in ms — silent polls default to 1.5s, user actions to 3s */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 3000;
const SILENT_TIMEOUT_MS = 1500;

export async function fetchFromBackend<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T | null> {
  const { silent = false, timeoutMs, ...requestInit } = options;
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const signal =
      requestInit.signal ||
      AbortSignal.timeout(timeoutMs ?? (silent ? SILENT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS));
    const res = await fetch(url, {
      ...requestInit,
      signal,
      headers: buildHeaders(requestInit.headers),
    });


    if (!res.ok) {
      const hadBearer = Boolean(getBearerToken()) && !getApiKey();
      // Stale JWT: drop it and retry once so the BFF can inject ARTSA_API_KEY.
      if (res.status === 401 && hadBearer) {
        useAuthStore.getState().clearBearerKeepUser();
        const retryRes = await fetch(url, {
          ...requestInit,
          signal,
          headers: buildHeaders(requestInit.headers),
        });
        if (retryRes.ok) {
          const raw = await retryRes.json();
          return unwrapEnvelope(raw) as T;
        }
      }
      if (!silent) {
        // Attempt to extract error detail from envelope or raw body
        let errorMsg = `${endpoint} returned ${res.status}`;
        try {
          const errorBody = await res.json();
          const unwrapped = unwrapEnvelope(errorBody);
          if (typeof unwrapped === "object" && unwrapped !== null) {
            const err = unwrapped as Record<string, unknown>;
            errorMsg = String(err.message ?? err.detail ?? errorMsg);
          } else if (typeof unwrapped === "string" && unwrapped.trim()) {
            errorMsg = unwrapped;
          }
        } catch {
          // can't parse — use status-only message
        }
        // Corrupted Next dev cache surfaces as proxy 500 with no JSON — point to fix.
        if (res.status >= 500 && errorMsg.includes("returned 5")) {
          errorMsg =
            "Frontend API proxy failed (stale dev cache). Stop the dev server and run: npm run dev:clean";
        }
        toast(res.status === 429 ? "Slow down" : "Request failed", {
          description:
            res.status === 429
              ? String(errorMsg).includes("Quota") || String(errorMsg).includes("Rate")
                ? errorMsg
                : "Too many requests — wait a minute and try again."
              : errorMsg,
          variant: "error",
        });
      }
      return null;
    }

    const raw = await res.json();
    return unwrapEnvelope(raw) as T;
  } catch (err) {
    if (!silent) {
      toast("Backend unreachable", {
        description: API_UNAVAILABLE.hint,
        variant: "error",
      });
    }
    console.warn(`[ARTSA API] Unable to reach ${url}:`, (err as Error).message);
    return null;
  }
}
