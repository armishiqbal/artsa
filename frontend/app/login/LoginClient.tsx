"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, Sparkles } from "lucide-react";
import { AuthShell, authFieldClass, authLabelClass } from "@/components/auth/AuthShell";
import {
  type AuthResponse,
  type AuthStatus,
  postAuth,
  RETURN_TO_KEY,
  authSignupHref,
} from "@/lib/authSession";
import { unwrapEnvelope } from "@/lib/api";
import { isOidcEnabled, startOidcLogin } from "@/lib/oidc";
import { useAuthStore } from "@/lib/stores/auth";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);

  const returnTo = searchParams.get("returnTo") || "";
  const dest = returnTo.startsWith("/") ? returnTo : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/backend/api/v1/auth/status")
      .then((res) => res.json())
      .then((raw) => {
        if (cancelled) return;
        const status = unwrapEnvelope(raw) as AuthStatus;
        setRegistrationOpen(Boolean(status?.registration_open));
      })
      .catch(() => {
        if (!cancelled) setRegistrationOpen(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const finishWithSession = (session: AuthResponse) => {
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
      finishWithSession(session);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid email or password.";
      setError(
        message === "Invalid email or password" ? "Incorrect email or password." : message
      );
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setError(null);
    finishWithSession({
      access_token: "demo_preview_token",
      token_type: "bearer",
      expires_in: 86400,
      user: {
        email: "admin@artsa.ai",
        role: "admin",
        display_name: "Admin (Live Preview)",
      },
    });
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
      returnTo={dest !== "/dashboard" ? dest : undefined}
    >
      <form onSubmit={(e) => void handleLogin(e)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login-email" className={authLabelClass}>
            Work email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7c7c7c]" aria-hidden />
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
            <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7c7c7c]" aria-hidden />
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
            className="rounded-[8px] border border-[#313131] bg-[#0a0a0a] px-3 py-2 text-[13px] text-[#a7a7a7]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-white text-[14px] font-medium text-[#0a0a0a] transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {isOidcEnabled() ? (
        <div className="mt-4">
          <p className="mb-3 text-center text-[12px] uppercase tracking-[0.08em] text-[#7c7c7c]">or</p>
          <button
            type="button"
            className="inline-flex h-11 w-full items-center justify-center rounded-[8px] border border-[#454545] text-[14px] font-medium text-white hover:border-[#a7a7a7] disabled:opacity-50"
            onClick={() => void handleSsoLogin()}
            disabled={loading}
          >
            Continue with SSO
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="mb-3 text-center text-[12px] uppercase tracking-[0.08em] text-[#7c7c7c]">or</p>
        <button
          type="button"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-[#454545] text-[14px] font-medium text-white hover:border-[#a7a7a7] disabled:opacity-50"
          onClick={handleDemoLogin}
          disabled={loading}
        >
          <Sparkles className="h-4 w-4 text-[#6798ff]" aria-hidden />
          Explore live preview
        </button>
      </div>

      <p className="mt-6 text-center text-[14px] text-[#a7a7a7]">
        {registrationOpen === false ? (
          <>
            Need access?{" "}
            <Link href="/#contact" className="font-medium text-white hover:text-[#6798ff]">
              Contact sales
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link
              href={authSignupHref({ returnTo: dest !== "/dashboard" ? dest : undefined })}
              className="font-medium text-white hover:text-[#6798ff]"
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
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
          <Loader2 className="h-6 w-6 animate-spin text-[#a7a7a7]" aria-hidden />
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
