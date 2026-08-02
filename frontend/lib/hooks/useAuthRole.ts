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

const ADMIN_CAPABILITIES: AuthCapabilities = {
  can_ingest: true,
  can_run_campaigns: true,
  can_run_benchmark: true,
  can_run_ablation: true,
  can_manage_policies: true,
  read_only: false,
};

const DEFAULT_IDENTITY: AuthIdentity = {
  authenticated: true,
  role: "admin",
  capabilities: ADMIN_CAPABILITIES,
  auth_required: false,
};

export function useAuthRole() {
  const [identity, setIdentity] = useState<AuthIdentity>(DEFAULT_IDENTITY);
  const [loading, setLoading] = useState(true);
  const bearerToken = useAuthStore((s) => s.bearerToken);

  const refresh = () =>
    fetchFromBackend<AuthIdentity>("/api/v1/config/me", { silent: true }).then((res) => {
      if (res) setIdentity(res);
      setLoading(false);
    });

  useEffect(() => {
    refresh();
  }, [bearerToken]);

  return { identity, loading, capabilities: identity.capabilities, refresh };
}
