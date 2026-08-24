"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { CONNECTION_UI } from "@/lib/getStartedLabels";

const DISMISS_KEY = "artsa-backend-offline-dismiss";

export function BackendOfflineBanner() {
  const { apiOnline } = useConnection();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (apiOnline) {
      try {
        sessionStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
      setDismissed(false);
    }
  }, [apiOnline]);

  if (apiOnline || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="mb-5 flex flex-col gap-3 rounded-xl border border-destructive/35 bg-destructive/5 p-4 sm:flex-row sm:items-start sm:justify-between"
      role="status"
    >
      <div className="flex min-w-0 gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{CONNECTION_UI.backendOfflineTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{CONNECTION_UI.backendOfflineHint}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link href="/settings/integrations">{CONNECTION_UI.whenOfflinePrimary}</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/get-started">{CONNECTION_UI.whenOfflineSecondary}</Link>
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={dismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
