import { NextResponse } from "next/server";

/**
 * Shared OIDC token-exchange handler used by both the /api/auth/token and
 * /api/auth/refresh routes.
 *
 * Each Next.js App Router route file must define (not re-export) its own
 * handlers, so the concrete logic lives here and is imported by both routes.
 */

const OIDC_ISSUER = (process.env.OIDC_ISSUER || process.env.NEXT_PUBLIC_OIDC_ISSUER || "").replace(
  /\/$/,
  ""
);
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "";
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || "";

async function getTokenEndpoint(): Promise<string> {
  const res = await fetch(`${OIDC_ISSUER}/.well-known/openid-configuration`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("OIDC discovery failed");
  const doc = await res.json();
  return doc.token_endpoint as string;
}

function tokenPayload(payload: Record<string, unknown>) {
  return NextResponse.json({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_in: payload.expires_in,
    token_type: payload.token_type,
  });
}

export async function handleTokenExchange(request: Request) {
  if (!OIDC_ISSUER || !OIDC_CLIENT_ID) {
    return NextResponse.json({ error: "OIDC not configured on server" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const tokenEndpoint = await getTokenEndpoint();
    const params = new URLSearchParams({
      client_id: OIDC_CLIENT_ID,
    });

    if (OIDC_CLIENT_SECRET) {
      params.set("client_secret", OIDC_CLIENT_SECRET);
    }

    if (body.refresh_token) {
      params.set("grant_type", "refresh_token");
      params.set("refresh_token", body.refresh_token);
    } else {
      const { code, redirect_uri, code_verifier } = body;
      if (!code || !redirect_uri || !code_verifier) {
        return NextResponse.json(
          { error: "Missing code, redirect_uri, or code_verifier" },
          { status: 400 }
        );
      }
      params.set("grant_type", "authorization_code");
      params.set("code", code);
      params.set("redirect_uri", redirect_uri);
      params.set("code_verifier", code_verifier);
    }

    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const payload = await tokenRes.json();
    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: payload.error_description || payload.error || "Token request rejected" },
        { status: 401 }
      );
    }

    return tokenPayload(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token exchange error" },
      { status: 500 }
    );
  }
}
