"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { hydrateAuthStore } from "@/lib/stores/auth";

const PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);
const HAS_STATIC_API_KEY = Boolean(process.env.NEXT_PUBLIC_ARTSA_API_KEY);

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Redirects unauthenticated users to /login when the backend requires auth or OIDC is enabled.
 * Skips guard for public routes and when a static API key is configured.
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
    if (!hydrated || loading || PUBLIC_PATHS.has(pathname) || HAS_STATIC_API_KEY) return;

    const authEnforced = identity.auth_required || identity.oidc_enabled;
    if (authEnforced && !identity.authenticated) {
      const returnTo = encodeURIComponent(pathname);
      router.replace(`/login?returnTo=${returnTo}`);
    }
  }, [hydrated, loading, identity, pathname, router]);

  if (!hydrated || (loading && !PUBLIC_PATHS.has(pathname) && !HAS_STATIC_API_KEY)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (
    !PUBLIC_PATHS.has(pathname) &&
    !HAS_STATIC_API_KEY &&
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
