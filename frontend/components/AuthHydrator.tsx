"use client";

import { useEffect } from "react";
import { hydrateAuthStore, getRefreshToken, tokenNeedsRefresh, useAuthStore } from "@/lib/stores/auth";
import { refreshAccessToken } from "@/lib/oidc";

const CHECK_INTERVAL_MS = 60_000;

/** Hydrates auth state and silently refreshes OIDC tokens before expiry. */
export function AuthHydrator() {
  const setSession = useAuthStore((s) => s.setSession);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    hydrateAuthStore();
  }, []);

  useEffect(() => {
    const tryRefresh = async () => {
      if (!getRefreshToken() || !tokenNeedsRefresh()) return;
      try {
        const tokens = await refreshAccessToken(getRefreshToken()!);
        setSession(tokens);
      } catch {
        clearAuth();
      }
    };

    tryRefresh();
    const id = window.setInterval(tryRefresh, CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [setSession, clearAuth]);

  return null;
}
