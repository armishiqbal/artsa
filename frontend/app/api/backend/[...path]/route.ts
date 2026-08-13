import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side BFF proxy to the ARTSA backend.
 *
 * The browser never talks to the backend directly for REST calls: it hits
 * /api/backend/... on this Next.js server, which forwards the request and
 * injects the server-only API key (ARTSA_API_KEY). This keeps credentials
 * out of the client bundle. OIDC bearer tokens set by the browser are still
 * forwarded via the Authorization header.
 */
export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Server-only credential — never exposed to the client. */
const SERVER_API_KEY = process.env.ARTSA_API_KEY || "";

const PROXY_TIMEOUT_MS = 30_000;

async function proxy(request: NextRequest, ctx: { params: { path: string[] } }) {
  const path = ctx.params.path.join("/");
  const query = request.nextUrl.search;
  const target = `${BACKEND_URL}/${path}${query}`;

  const headers = new Headers();
  const xApiKey = request.headers.get("x-api-key");
  const auth = request.headers.get("authorization");
  if (xApiKey) {
    // Role API key supplied by the browser (API-key sign-in) — forward as-is.
    headers.set("x-api-key", xApiKey);
  } else if (auth) {
    // OIDC bearer token set by the browser — forward as-is.
    headers.set("authorization", auth);
  } else if (SERVER_API_KEY) {
    // No client credential — fall back to the server-only admin key.
    headers.set("x-api-key", SERVER_API_KEY);
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
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });

    const responseBody = await res.arrayBuffer();
    return new NextResponse(responseBody, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Backend proxy error" },
      { status: 502 }
    );
  }
}

export { proxy as DELETE, proxy as GET, proxy as PATCH, proxy as POST, proxy as PUT };
