"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn, KeyRound } from "lucide-react";
import { LogoIcon } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { isOidcEnabled, startOidcLogin } from "@/lib/oidc";
import { useAuthStore } from "@/lib/stores/auth";

const RETURN_TO_KEY = "artsa_return_to";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiKey = useAuthStore((s) => s.apiKey);
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnTo = searchParams.get("returnTo") || "/";

  useEffect(() => {
    if (apiKey) {
      const dest = returnTo.startsWith("/") ? returnTo : "/";
      router.replace(dest);
    }
  }, [apiKey, router, returnTo]);

  const handleKeyLogin = async () => {
    const key = keyInput.trim();
    if (!key) {
      setError("Enter your ARTSA API key to continue.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setApiKey(key);
      // AuthGuard refreshes identity from /config/me on the next render.
      router.replace(returnTo.startsWith("/") ? returnTo : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setLoading(false);
    }
  };

  const handleSsoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      sessionStorage.setItem(RETURN_TO_KEY, returnTo.startsWith("/") ? returnTo : "/");
      const redirectUri = `${window.location.origin}/auth/callback`;
      await startOidcLogin(redirectUri);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start SSO login");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl brand-bg-subtle brand-border brand-glow-sm">
        <LogoIcon size={32} aria-hidden />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Sign in to ARTSA</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Authenticate with a role API key or your organization SSO.
      </p>

      <div className="mt-8 w-full">
        <DashboardCard title="API key" description="Use your admin, analyst, red-team or read-only key.">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <KeyRound
                className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="password"
                placeholder="artsa-admin-… or artsa-analyst-…"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleKeyLogin();
                }}
                className="pl-9"
                aria-label="API key"
              />
            </div>
            <Button size="lg" onClick={handleKeyLogin} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden />
              )}
              Sign in with API key
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
