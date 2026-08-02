/**
 * OIDC PKCE helpers for browser-based SSO login.
 */

const OIDC_ENABLED = process.env.NEXT_PUBLIC_OIDC_ENABLED === "true";
const OIDC_ISSUER = (process.env.NEXT_PUBLIC_OIDC_ISSUER || "").replace(/\/$/, "");
const OIDC_CLIENT_ID = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "";
const OIDC_SCOPE = process.env.NEXT_PUBLIC_OIDC_SCOPE || "openid profile email";

const PKCE_VERIFIER_KEY = "artsa_oidc_verifier";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isOidcEnabled(): boolean {
  return OIDC_ENABLED && Boolean(OIDC_ISSUER && OIDC_CLIENT_ID);
}

export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64UrlEncode(array);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

export function storePkceVerifier(verifier: string): void {
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
}

export function consumePkceVerifier(): string | null {
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  return verifier;
}

export async function fetchOidcDiscovery(): Promise<{
  authorization_endpoint: string;
  token_endpoint: string;
}> {
  const res = await fetch(`${OIDC_ISSUER}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error("Failed to load OIDC discovery document");
  return res.json();
}

export async function startOidcLogin(redirectUri: string): Promise<void> {
  const { verifier, challenge } = await generatePkcePair();
  storePkceVerifier(verifier);

  const discovery = await fetchOidcDiscovery();
  const params = new URLSearchParams({
    client_id: OIDC_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: OIDC_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  window.location.href = `${discovery.authorization_endpoint}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const res = await fetch("/api/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri, code_verifier: codeVerifier }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Token exchange failed");
  }

  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Token refresh failed");
  }

  return res.json();
}
