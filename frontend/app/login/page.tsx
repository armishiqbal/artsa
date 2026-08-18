"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, LogIn, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { LogoIcon } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { unwrapEnvelope } from "@/lib/api";
import { isOidcEnabled, startOidcLogin } from "@/lib/oidc";
import { useAuthStore } from "@/lib/stores/auth";

const RETURN_TO_KEY = "artsa_return_to";

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  user: { email: string; role: string; display_name: string };
  password_auth_enabled?: boolean;
}

/** POST to a public auth endpoint and unwrap the envelope, raising the backend's
 * `detail` so it can be shown inline (invalid credentials, closed registration…). */
async function postAuth(path: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(`/api/backend${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.json().catch(() => ({}));
  const unwrapped = unwrapEnvelope(raw) as Record<string, unknown> | null;
  if (!res.ok) {
    const detail = (unwrapped as Record<string, unknown> | null)?.detail;
    throw new Error(
      typeof detail === "string" && detail ? detail : `Request failed (${res.status})`
    );
  }
  return unwrapped as unknown as AuthResponse;
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiKey = useAuthStore((s) => s.apiKey);
  const bearerToken = useAuthStore((s) => s.bearerToken);
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const setSession = useAuthStore((s) => s.setSession);

  const returnTo = searchParams.get("returnTo") || "";
  const dest = returnTo.startsWith("/") ? returnTo : "/dashboard";

  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "register" || requestedMode === "login") {
      setMode(requestedMode);
    }
  }, [searchParams]);

  // Already signed in (API key or session token) — go straight through.
  useEffect(() => {
    if (apiKey || bearerToken) router.replace(dest);
  }, [apiKey, bearerToken, router, dest]);

  const redirect = () => router.replace(dest);

  const finishWithSession = (session: AuthResponse) => {
    // A password session supersedes any previously stored API key — otherwise
    // api.ts would keep sending X-API-Key and the new bearer would be ignored.
    setApiKey(null);
    setSession({ access_token: session.access_token, expires_in: session.expires_in }, session.user);
    redirect();
  };

  const handleDemoLogin = () => {
    finishWithSession({
      access_token: "demo_preview_token",
      token_type: "bearer",
      expires_in: 86400,
      user: {
        email: email.trim() || "admin@artsa.ai",
        role: "admin",
        display_name: displayName.trim() || "Admin (Live Preview)",
      },
    });
  };

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await postAuth("/api/v1/auth/login", { email, password });
      finishWithSession(session);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      if (msg.includes("404") || msg.includes("502") || msg.includes("Failed to fetch")) {
        setError("Backend server is not connected yet (404). You can click 'Explore Demo Mode' below to test the full live dashboard!");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await postAuth("/api/v1/auth/register", {
        email,
        password,
        display_name: displayName.trim(),
      });
      finishWithSession(session);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Account creation failed";
      if (msg.includes("404") || msg.includes("502") || msg.includes("Failed to fetch")) {
        setError("Backend server is not connected yet (404). You can click 'Explore Demo Mode' below to test the full live dashboard!");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  const handleSsoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      sessionStorage.setItem(RETURN_TO_KEY, dest);
      const redirectUri = `${window.location.origin}/auth/callback`;
      await startOidcLogin(redirectUri);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start SSO login");
      setLoading(false);
    }
  };

  const isRegister = mode === "register";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl brand-bg-subtle brand-border brand-glow-sm">
        <LogoIcon size={32} aria-hidden />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Sign in to ARTSA</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {isRegister
          ? "Create your account. The first account becomes the administrator."
          : "Sign in with your email & password to enter."}
      </p>

      <div className="mt-8 w-full">
        <DashboardCard
          title={isRegister ? "Create account" : "Sign in"}
          description={
            isRegister
              ? "Password must be at least 8 characters."
              : "Use the account your administrator created for you."
          }
        >
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Mail
                className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (isRegister) handleRegister();
                  else handlePasswordLogin();
                }}
                className="pl-9"
                aria-label="Email"
              />
            </div>
            {isRegister && (
              <Input
                type="text"
                placeholder="Display name (optional)"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                aria-label="Display name"
              />
            )}
            <div className="relative">
              <Lock
                className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="password"
                placeholder="Password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (isRegister) handleRegister();
                  else handlePasswordLogin();
                }}
                className="pl-9"
                aria-label="Password"
              />
            </div>
            <Button
              size="lg"
              onClick={isRegister ? handleRegister : handlePasswordLogin}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : isRegister ? (
                <UserPlus className="h-4 w-4" aria-hidden />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden />
              )}
              {isRegister ? "Create account" : "Sign in"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode(isRegister ? "login" : "register");
                setError(null);
              }}
              className="text-sm text-primary hover:underline"
            >
              {isRegister ? "Already have an account? Sign in" : "New to ARTSA? Create account"}
            </button>

            <div className="relative my-2 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <span className="relative bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">
                or
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full gap-2 border-dashed border-primary/50 text-primary hover:bg-primary/10"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Explore Demo Mode (Live Preview)
            </Button>
          </div>
        </DashboardCard>

        {isOidcEnabled() && (
          <div className="mt-4 text-center">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              or continue with
            </p>
            <Button variant="outline" size="lg" className="w-full gap-2" onClick={handleSsoLogin} disabled={loading}>
              <LogIn className="h-4 w-4" aria-hidden />
              Organization SSO
            </Button>
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-severity-critical">{error}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
