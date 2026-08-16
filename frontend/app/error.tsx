"use client";

import { useEffect } from "react";
import { ErrorPage } from "@/components/shared/ErrorPage";

/**
 * Route-level error boundary (Next.js App Router). Catches render/loader
 * errors in any page segment under the root layout and shows a recovery
 * screen instead of a blank page.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Best-effort diagnostics — never let logging crash the boundary.
    console.error("ARTSA page error:", error);
  }, [error]);

  return <ErrorPage onReset={reset} />;
}
