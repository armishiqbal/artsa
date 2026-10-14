"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";
import { AuthShell, authFieldClass, authLabelClass } from "@/components/auth/AuthShell";
import {
  type AuthResponse,
  type AuthStatus,
  postAuth,
  RETURN_TO_KEY,
  authSignupHref,
} from "@/lib/authSession";
import { fetchFromBackend } from "@/lib/api";
import { isOidcEnabled, startOidcLogin } from "@/lib/oidc";
import { hydrateAuthStore, useAuthStore } from "@/lib/stores/auth";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);

  const returnTo = searchParams.get("returnTo") || "";
  const dest = returnTo.startsWith("/") ? returnTo : "/command-center";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(true);

  useEffect(() => {
    let cancelled = false;
    fetchFromBackend<AuthStatus>("/api/v1/auth/status", { silent: true, timeoutMs: 1500 })
      .then((status) => {
        if (cancelled) return;
        if (status) {
          setRegistrationOpen(Boolean(status.registration_open));
        }
      })
      .catch(() => {
        if (!cancelled) setRegistrationOpen(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const finishWithSession = async (session: AuthResponse) => {
    // The first store hydration can still be in flight if login returns before
    // the app shell finishes mounting. Wait so an older persisted value cannot
    // overwrite this newly issued session during the protected-route redirect.
    await hydrateAuthStore();
    setSession({ access_token: session.access_token, expires_in: session.expires_in }, session.user);
    router.replace(dest);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your work email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await postAuth("/api/v1/auth/login", {
        email: email.trim(),
        password,
      });
      await finishWithSession(session);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid email or password.";
      setError(
        message === "Invalid email or password" ? "Incorrect email or password." : message
      );
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
      setError(err instanceof Error ? err.message : "Failed to start SSO sign-in");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mode="signin"
      title="Sign in"
      subtitle="Enter your work email to access your ARTSA workspace."
      returnTo={dest !== "/command-center" ? dest : undefined}
    >
      <form onSubmit={(e) => void handleLogin(e)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login-email" className={authLabelClass}>
            Work email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className={`${authFieldClass} pl-10`}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className={authLabelClass}>
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className={`${authFieldClass} pl-10`}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              required
            />
          </div>
        </div>

        {error ? (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {isOidcEnabled() ? (
        <div className="mt-5">
          <p className="mb-3 text-center text-xs font-mono uppercase tracking-wider text-slate-400">or</p>
          <button
            type="button"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50"
            onClick={() => void handleSsoLogin()}
            disabled={loading}
          >
            Continue with SSO
          </button>
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-slate-500">
        {registrationOpen === false ? (
          <>
            Need access?{" "}
            <Link href="/#contact" className="font-semibold text-blue-600 underline-offset-4 hover:underline">
              Contact sales
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link
              href={authSignupHref({ returnTo: dest !== "/command-center" ? dest : undefined })}
              className="font-semibold text-blue-600 underline-offset-4 hover:underline"
            >
              Sign up
            </Link>
          </>
        )}
      </p>
    </AuthShell>
  );
}

export default function LoginClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white" data-theme="light">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
