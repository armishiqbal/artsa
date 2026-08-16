/**
 * HTTP client for the unified ARTSA API (containment + wargame + library on port 8000).
 *
 * Response envelope migration (A6):
 *   When the backend has ARTSA_RESPONSE_ENVELOPE=true, all JSON responses are
 *   wrapped as {"success":bool, "data":<payload>, "meta":{...}}.
 *   This client transparently unwraps so callers always receive the inner payload.
 */

import { toast } from "@/lib/stores/toast";
import { getApiKey, getBearerToken } from "@/lib/stores/auth";

const API_BASE_URL = "/api/backend";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

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
    if (bearer) {
      headers["Authorization"] = `Bearer ${bearer}`;
    }
  }
  return headers;
}

export function buildHeaders(extra?: HeadersInit): HeadersInit {
  return {
    "Content-Type": "application/json",
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
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    const envelope = body as { success: boolean; data?: unknown; error?: unknown };
    if (envelope.success) {
      return envelope.data ?? body;
    }
    // Error path: surface the error object so callers can inspect it
    return envelope.error ?? body;
  }
  return body;
}

export interface FetchOptions extends RequestInit {
  /** Suppress error toasts (for background polling) */
  silent?: boolean;
}

export async function fetchFromBackend<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T | null> {
  const { silent = false, ...requestInit } = options;
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...requestInit,
      headers: buildHeaders(requestInit.headers),
    });

    if (!res.ok) {
      if (!silent) {
        // Attempt to extract error detail from envelope or raw body
        let errorMsg = `${endpoint} returned ${res.status}`;
        try {
          const errorBody = await res.json();
          const unwrapped = unwrapEnvelope(errorBody);
          if (typeof unwrapped === "object" && unwrapped !== null) {
            const err = unwrapped as Record<string, unknown>;
            errorMsg = String(err.message ?? err.detail ?? errorMsg);
          }
        } catch {
          // can't parse — use status-only message
        }
        toast("Request failed", {
          description: errorMsg,
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
        description: `Ensure the API is running on port ${backendPort()}.`,
        variant: "error",
      });
    }
    console.warn(`[ARTSA API] Unable to reach ${url}:`, (err as Error).message);
    return null;
  }
}
