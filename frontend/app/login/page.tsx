"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { isOidcEnabled, startOidcLogin } from "@/lib/oidc";
import { useAuthStore } from "@/lib/stores/auth";

const RETURN_TO_KEY = "artsa_return_to";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bearerToken = useAuthStore((s) => s.bearerToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnTo = searchParams.get("returnTo") || "/";

  useEffect(() => {
    if (bearerToken) {
      const dest = returnTo.startsWith("/") ? returnTo : "/";
      router.replace(dest);
    }
  }, [bearerToken, router, returnTo]);

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

  if (!isOidcEnabled()) {
    return (
      <div className="mx-auto max-w-md py-16">
        <DashboardCard title="Sign in" description="OIDC SSO is not enabled for this deployment.">
          <p className="text-sm text-muted-foreground">
            Configure <code className="font-mono text-xs">NEXT_PUBLIC_OIDC_ENABLED=true</code> or set a
            server-side <code className="font-mono text-xs">ARTSA_API_KEY</code> (see{" "}
            <code className="font-mono text-xs">.env.local.example</code>) so the API proxy can authenticate.
          </p>
        </DashboardCard>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <Shield className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Sign in to ARTSA</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Use your organization SSO to access the containment platform.
      </p>

      <Button className="mt-8 w-full gap-2" size="lg" onClick={handleSsoLogin} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Redirecting…
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" aria-hidden />
            Continue with SSO
          </>
        )}
      </Button>

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
