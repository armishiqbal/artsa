import { unwrapEnvelope } from "@/lib/api";

export interface SignInOptions {
  returnTo?: string;
  mode?: "login" | "register";
}

export const RETURN_TO_KEY = "artsa_return_to";

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  user: { email: string; role: string; display_name: string };
  password_auth_enabled?: boolean;
}

export interface AuthStatus {
  password_auth_enabled?: boolean;
  registration_open?: boolean;
  has_admin?: boolean;
}

/** POST to a public auth endpoint and surface backend `detail` inline. */
export async function postAuth(path: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(`/api/backend${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.json().catch(() => ({}));
  const unwrapped = unwrapEnvelope(raw) as Record<string, unknown> | null;
  if (!res.ok) {
    const err = unwrapped as Record<string, unknown> | null;
    const detail = err?.detail ?? err?.message;
    throw new Error(
      typeof detail === "string" && detail ? detail : `Request failed (${res.status})`
    );
  }
  return unwrapped as unknown as AuthResponse;
}

export function authLoginHref(options?: { returnTo?: string }) {
  const params = new URLSearchParams();
  if (options?.returnTo?.startsWith("/")) params.set("returnTo", options.returnTo);
  const q = params.toString();
  return q ? `/login?${q}` : "/login";
}

export function authSignupHref(options?: { returnTo?: string }) {
  const params = new URLSearchParams();
  if (options?.returnTo?.startsWith("/")) params.set("returnTo", options.returnTo);
  const q = params.toString();
  return q ? `/signup?${q}` : "/signup";
}

/** @deprecated Prefer authLoginHref / authSignupHref — kept for older call sites. */
export function landingSignInHref(options?: { returnTo?: string; mode?: "login" | "register" }) {
  if (options?.mode === "register") return authSignupHref({ returnTo: options.returnTo });
  return authLoginHref({ returnTo: options?.returnTo });
}
