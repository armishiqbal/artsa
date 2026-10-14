"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";

export interface ProviderOption {
  id: string;
  name: string;
  type: string;
  model: string;
  configured: boolean;
}

export function useProviders() {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [environment, tenant] = await Promise.all([
      fetchFromBackend<{
        providers?: ProviderOption[];
        environment_fallback_enabled?: boolean;
      }>("/api/v1/config/providers", { silent: true, timeoutMs: 2_000 }),
      fetchFromBackend<{
        providers?: Array<{
          id: string;
          name: string;
          provider_type: string;
          default_model?: string | null;
          enabled: boolean;
          api_key_masked?: string;
        }>;
      }>("/api/v1/providers", { silent: true, timeoutMs: 2_000 }),
    ]);
    const merged = new Map<string, ProviderOption>();
    for (const provider of environment?.providers ?? []) {
      merged.set(provider.id, {
        ...provider,
        configured: Boolean(
          environment?.environment_fallback_enabled && provider.configured
        ),
      });
    }
    for (const provider of tenant?.providers ?? []) {
      // The campaign API accepts the tenant provider name as its selector;
      // the immutable DB row ID is resolved server-side and never sent to UI.
      merged.set(provider.name, {
        id: provider.name,
        name: provider.name,
        type: provider.provider_type,
        model: provider.default_model ?? "",
        configured: provider.enabled && Boolean(provider.api_key_masked),
      });
    }
    setProviders([...merged.values()]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { providers, loading, refresh };
}
