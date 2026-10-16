"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { hydrateAuthStore, useAuthStore } from "@/lib/stores/auth";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/signup",
  "/auth/callback",
  "/demo",
  "/get-started",
  "/risks",
  "/guides/rag-astra",
  "/guides/guard-capabilities",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return pathname.startsWith("/guides/");
}

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Client-side navigation guard for operational pages. Backend authorization
 * remains the security boundary; public entry points include / and /signup.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const apiKey = useAuthStore((s) => s.apiKey);
  const hasBearer = useAuthStore((s) => Boolean(s.bearerToken));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    void hydrateAuthStore().then(() => {
      if (mounted) setHydrated(true);
    });
    const timer = setTimeout(() => {
      if (mounted) setHydrated(true);
    }, 100);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  const isPublic = isPublicPath(pathname);
  const hasCredential = Boolean(apiKey || hasBearer);

  useEffect(() => {
    if (!hydrated || isPublic || hasCredential) return;
    const returnTo = encodeURIComponent(pathname);
    router.replace(`/login?returnTo=${returnTo}`);
  }, [hydrated, isPublic, hasCredential, pathname, router]);

  if (!hydrated && !isPublic) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!isPublic && !hasCredential) {
    // About to be redirected — hold the spinner instead of flashing the page.
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return <>{children}</>;
}
