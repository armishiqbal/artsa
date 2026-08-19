import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side BFF proxy to the ARTSA backend.
 *
 * The browser never talks to the backend directly for REST calls: it hits
 * /api/backend/... on this Next.js server, which forwards the request and
 * injects the server-only API key (ARTSA_API_KEY). This keeps credentials
 * out of the client bundle. OIDC bearer tokens set by the browser are still
 * forwarded via the Authorization header.
 *
 * HONESTY RULE: when the backend is unreachable this proxy NEVER fabricates
 * security data. A guardrail that shows invented "CRITICAL alerts" or a fake
 * "healthy" status is worse than one that says offline — operators must be
 * able to trust the numbers. Downstream, the dashboard renders honest empty
 * states, and the connection indicator reads the health probe to show OFFLINE.
 */
export const dynamic = "force-dynamic";

/** Server-only credential — never exposed to the client. */
const SERVER_API_KEY = process.env.ARTSA_API_KEY || "";

// Dashboard polls stay snappy; login/register need longer because PBKDF2
// hashing often exceeds 2s.
const PROXY_TIMEOUT_MS = 2_000;
const AUTH_PROXY_TIMEOUT_MS = 20_000;

function isOfflinePreviewAuthorization(authorization: string | null): boolean {
  const token = authorization?.trim().replace(/^Bearer\s+/i, "");
  return token === "demo_preview_token" || Boolean(token?.startsWith("admin_token_"));
}

function isAuthCredentialPath(path: string): boolean {
  return path.includes("auth/login") || path.includes("auth/register");
}

async function proxy(
  request: NextRequest,
  ctx: { params: { path: string[] } | Promise<{ path: string[] }> }
) {
  const resolvedParams = await Promise.resolve(ctx?.params);
  const pathSegments = resolvedParams?.path || [];
  const path = Array.isArray(pathSegments) ? pathSegments.join("/") : String(pathSegments);
  const query = request.nextUrl.search;
  const baseUrl = (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000"
  ).replace(/\/+$/, "");
  const target = `${baseUrl}/${path.replace(/^\/+/, "")}${query}`;

  const headers = new Headers();
  const xApiKey = request.headers.get("x-api-key");
  const auth = request.headers.get("authorization");
  const isOfflinePreviewToken = isOfflinePreviewAuthorization(auth);
  if (!isAuthCredentialPath(path)) {
    if (xApiKey) {
      headers.set("x-api-key", xApiKey);
    } else if (auth && !isOfflinePreviewToken) {
      headers.set("authorization", auth);
    } else if (SERVER_API_KEY) {
      headers.set("x-api-key", SERVER_API_KEY);
    }
  }
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  try {
    const res = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(
        isAuthCredentialPath(path) ? AUTH_PROXY_TIMEOUT_MS : PROXY_TIMEOUT_MS
      ),
    });

    const responseBody = await res.arrayBuffer();
    return new NextResponse(responseBody, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";

    // Auth: honest failure — point the operator at the real backend or the
    // client-side "Explore Live Preview" (which needs no credentials).
    if (isAuthCredentialPath(path)) {
      return NextResponse.json(
        {
          detail: timedOut
            ? "Sign-in is taking too long. Keep the backend running and try again."
            : "Cannot reach the ARTSA API. Start the backend, or use 'Explore Live Preview'.",
        },
        { status: 502 }
      );
    }

    // Health probe: must NOT report healthy when the backend is unreachable —
    // the connection indicator depends on it to show OFFLINE honestly.
    if (path.includes("health")) {
      return NextResponse.json(
        {
          success: true,
          data: {
            status: "degraded",
            mode: "standalone-preview",
            api_gateway: { status: "offline" },
          },
        },
        { status: 503 }
      );
    }

    // Everything else: honest 503, no fabricated payloads, no internal details.
    return NextResponse.json(
      {
        detail: "Backend proxy unavailable — the ARTSA API is not reachable.",
      },
      { status: 503 }
    );
  }
}

export { proxy as DELETE, proxy as GET, proxy as PATCH, proxy as POST, proxy as PUT };
