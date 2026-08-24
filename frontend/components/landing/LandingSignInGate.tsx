"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LandingSignInPanel } from "./LandingSignInPanel";

function LandingSignInGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = searchParams.get("signin") === "1";
  const returnTo = searchParams.get("returnTo") || "";
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";

  const onClose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("signin");
    params.delete("mode");
    params.delete("returnTo");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/");
  }, [router, searchParams]);

  return (
    <LandingSignInPanel
      open={open}
      onClose={onClose}
      initialMode={initialMode}
      returnTo={returnTo}
    />
  );
}

export function LandingSignInGateFallback() {
  return null;
}

export function LandingSignInGateSuspense() {
  return (
    <Suspense fallback={<LandingSignInGateFallback />}>
      <LandingSignInGate />
    </Suspense>
  );
}
