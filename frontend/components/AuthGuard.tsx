"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { hydrateAuthStore } from "@/lib/stores/auth";

const PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Redirects unauthenticated users to /login when the backend requires auth or OIDC is enabled.
 * Skips guard for public routes. Auth state is sourced from the backend identity
 * endpoint — the client never holds an API key (injected server-side by the proxy).
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { identity, loading } = useAuthRole();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrateAuthStore();
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || loading || PUBLIC_PATHS.has(pathname)) return;

    const authEnforced = identity.auth_required || identity.oidc_enabled;
    if (authEnforced && !identity.authenticated) {
      const returnTo = encodeURIComponent(pathname);
      router.replace(`/login?returnTo=${returnTo}`);
    }
  }, [hydrated, loading, identity, pathname, router]);

  if (!hydrated || (loading && !PUBLIC_PATHS.has(pathname))) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (
    !PUBLIC_PATHS.has(pathname) &&
    (identity.auth_required || identity.oidc_enabled) &&
    !identity.authenticated
  ) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return <>{children}</>;
}
