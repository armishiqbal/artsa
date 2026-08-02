"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    fetchFromBackend<{ providers?: ProviderOption[] }>("/api/v1/config/providers", { silent: true }).then((data) => {
      if (data?.providers) {
        setProviders(data.providers);
      }
      setLoading(false);
    });
  }, []);

  return { providers, loading };
}
