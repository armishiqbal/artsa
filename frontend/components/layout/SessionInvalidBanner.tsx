"use client";

import Link from "next/link";
import { landingSignInHref } from "@/lib/authSession";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthRole } from "@/lib/hooks/useAuthRole";

/** Shown when the browser still has a session but the API rejects the token (401). */
export function SessionInvalidBanner() {
  const { identity, loading } = useAuthRole();

  if (loading || !identity.session_invalid) return null;

  return (
    <div
      className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="flex min-w-0 gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Session no longer valid on the API</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Live metrics, logs, and admin settings need a fresh sign-in. The backend health check can
            still pass while your browser token is expired or was signed with a different server key.
          </p>
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link href={landingSignInHref()}>Sign in again</Link>
      </Button>
    </div>
  );
}
