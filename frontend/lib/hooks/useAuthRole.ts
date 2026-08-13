"use client";

import { useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth";

export interface AuthCapabilities {
  can_ingest: boolean;
  can_run_campaigns: boolean;
  can_run_benchmark: boolean;
  can_run_ablation: boolean;
  can_manage_policies: boolean;
  can_manage_providers: boolean;
  read_only: boolean;
}

export interface AuthIdentity {
  authenticated: boolean;
  role: string;
  capabilities: AuthCapabilities;
  auth_required: boolean;
  auth_method?: string;
  oidc_enabled?: boolean;
}

const NO_CAPABILITIES: AuthCapabilities = {
  can_ingest: false,
  can_run_campaigns: false,
  can_run_benchmark: false,
  can_run_ablation: false,
  can_manage_policies: false,
  can_manage_providers: false,
  read_only: false,
};

// Least-privilege default: never flash admin UI before /config/me resolves.
// The real identity (role + capabilities) replaces this once loaded.
const DEFAULT_IDENTITY: AuthIdentity = {
  authenticated: false,
  role: "unauthenticated",
  capabilities: NO_CAPABILITIES,
  auth_required: false,
  oidc_enabled: false,
};

export function useAuthRole() {
  const [identity, setIdentity] = useState<AuthIdentity>(DEFAULT_IDENTITY);
  const [loading, setLoading] = useState(true);
  const bearerToken = useAuthStore((s) => s.bearerToken);
  const apiKey = useAuthStore((s) => s.apiKey);

  const refresh = () =>
    fetchFromBackend<AuthIdentity>("/api/v1/config/me", { silent: true }).then((res) => {
      if (res) setIdentity(res);
      setLoading(false);
    });

  useEffect(() => {
    refresh();
  }, [bearerToken, apiKey]);

  return { identity, loading, capabilities: identity.capabilities, refresh };
}
