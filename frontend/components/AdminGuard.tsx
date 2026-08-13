"use client";

import Link from "next/link";
import { Loader2, ShieldX } from "lucide-react";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { Button } from "@/components/ui/button";

/**
 * Restricts /admin/* pages to the admin role. Non-admin users see a
 * "no access" panel instead of the admin console.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { identity, loading } = useAuthRole();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (identity.role !== "admin") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
          <ShieldX className="h-7 w-7" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Admin access required</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            You are signed in as <span className="font-mono">{identity.role}</span>. The
            admin console is restricted to the admin role.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to Command Center</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
