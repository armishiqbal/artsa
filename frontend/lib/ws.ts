import { fetchFromBackend } from "@/lib/api";
import { getApiKey } from "@/lib/stores/auth";

/** Mint a short-lived, single-use WebSocket ticket from the backend. */
async function fetchWsTicket(): Promise<string | null> {
  const res = await fetchFromBackend<{ ticket?: string }>(
    "/api/v1/websocket/ticket",
    { method: "POST", silent: true }
  );
  return res?.ticket ?? null;
}

/**
 * Build an authenticated WebSocket URL (credentials via query params).
 *
 * Returns a promise: OIDC setups mint a short-lived, single-use ticket first so
 * the raw bearer token never appears in the URL (which lands in proxy/access
 * logs). Static API-key setups pass the key via query param as before.
 *
 * `auth` is optional and lets callers pass the current auth state explicitly
 * (kept in `useCallback` deps) so a token refresh triggers a reconnect with a
 * freshly-minted ticket. When omitted, credentials are read from the store.
 */
export async function buildWebSocketUrl(
  path = "/api/v1/websocket",
  auth?: { apiKey?: string | null; bearerToken?: string | null }
): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  let base: string;

  if (configured) {
    base = configured;
  } else {
    const httpBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    base = httpBase.replace(/^http/, "ws") + path;
  }

  const url = new URL(base);

  // Static-key setups authenticate via the api_key query param directly.
  const apiKey = auth?.apiKey ?? getApiKey();
  if (apiKey) {
    url.searchParams.set("api_key", apiKey);
    return url.toString();
  }

  // The WS connects straight to the backend (bypassing the Next BFF proxy), so
  // it must carry its own credential. Mint a short-lived single-use ticket —
  // reachable through the BFF, which injects the server-only key when the
  // browser has no bearer/API key — so the handshake is never left bare.
  try {
    const ticket = await fetchWsTicket();
    if (ticket) {
      url.searchParams.set("ticket", ticket);
    }
  } catch {
    // Backend not reachable / ticket endpoint absent — connect without one so
    // non-auth dev setups still work; the reconnect loop will retry.
  }

  return url.toString();
}
