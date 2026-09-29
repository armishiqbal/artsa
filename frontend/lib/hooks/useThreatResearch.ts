"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import { toast } from "@/lib/stores/toast";
import type {
  CuratePreviewResult,
  CuratePromoteResult,
  FrameworkMetrics,
  SyncThreatsResult,
  TargetSurfaceConfig,
  ThreatIntelligenceRecord,
} from "@/lib/types/research";

export interface UseThreatResearchOptions {
  autoFetch?: boolean;
}

export function useThreatResearch(options: UseThreatResearchOptions = {}) {
  const { autoFetch = true } = options;

  const [threats, setThreats] = useState<ThreatIntelligenceRecord[]>([]);
  const [metrics, setMetrics] = useState<FrameworkMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [curateResult, setCurateResult] = useState<CuratePreviewResult | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await fetchFromBackend<FrameworkMetrics>("/api/v1/research/frameworks", {
        silent: true,
      });
      if (data && typeof data.total_threats === "number") {
        setMetrics(data);
      }
    } catch (err: unknown) {
      // Non-fatal if metrics fails
      console.warn("Could not load research framework metrics", err);
    }
  }, []);

  const fetchThreats = useCallback(
    async (opts?: { query?: string; source?: string | null; category?: string | null }) => {
      setLoading(true);
      setError(null);
      try {
        const q = opts?.query !== undefined ? opts.query : searchQuery;
        const s = opts?.source !== undefined ? opts.source : selectedSource;
        const c = opts?.category !== undefined ? opts.category : selectedCategory;

        const params = new URLSearchParams();
        if (q.trim()) params.set("query", q.trim());
        if (s) params.set("source", s);
        if (c) params.set("category", c);

        const url = `/api/v1/research/threats${params.toString() ? `?${params.toString()}` : ""}`;
        const data = await fetchFromBackend<{ count: number; threats: ThreatIntelligenceRecord[] }>(url, {
          silent: true,
        });

        if (data && Array.isArray(data.threats)) {
          setThreats(data.threats);
        } else {
          setThreats([]);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load threat intelligence";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, selectedSource, selectedCategory]
  );

  const syncLiveFeeds = useCallback(
    async (query = "LLM agent", limit = 10): Promise<SyncThreatsResult | null> => {
      setSyncing(true);
      try {
        const res = await fetchFromBackend<SyncThreatsResult>("/api/v1/research/sync", {
          method: "POST",
          body: JSON.stringify({ query, limit }),
        });

        if (res && res.status === "success") {
          toast("Live Threat Feeds Synced", {
            description: `Ingested NVD: ${res.nvd_count}, MITRE ATLAS: ${res.mitre_atlas_count} (Total: ${res.total_ingested})`,
            variant: "success",
          });
          // Refresh list & metrics
          void fetchThreats();
          void fetchMetrics();
          return res;
        } else {
          toast("Sync finished", {
            description: "No new threat disclosures returned from feed.",
          });
          return res;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Feed synchronization failed";
        toast("Threat Sync Failed", {
          description: msg,
          variant: "error",
        });
        return null;
      } finally {
        setSyncing(false);
      }
    },
    [fetchThreats, fetchMetrics]
  );

  const simulateCurator = useCallback(
    async (surface: TargetSurfaceConfig): Promise<CuratePreviewResult | null> => {
      setSimulating(true);
      try {
        const res = await fetchFromBackend<CuratePreviewResult>("/api/v1/research/curate/preview", {
          method: "POST",
          body: JSON.stringify({
            tools: surface.tools,
            has_database: surface.has_database,
            has_bash: surface.has_bash,
            has_filesystem: surface.has_filesystem,
            has_rag: surface.has_rag,
            has_admin_tools: surface.has_admin_tools,
            query: searchQuery.trim() || undefined,
            source: selectedSource || undefined,
            category: selectedCategory || undefined,
          }),
        });

        if (res && typeof res.retained_count === "number") {
          setCurateResult(res);
          return res;
        }
        return null;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to simulate capability filtering";
        toast("Simulation Failed", {
          description: msg,
          variant: "error",
        });
        return null;
      } finally {
        setSimulating(false);
      }
    },
    [searchQuery, selectedSource, selectedCategory]
  );

  const promoteThreats = useCallback(
    async (threatIds?: string[], surface?: TargetSurfaceConfig): Promise<CuratePromoteResult | null> => {
      setPromoting(true);
      try {
        const res = await fetchFromBackend<CuratePromoteResult>("/api/v1/research/curate/promote", {
          method: "POST",
          body: JSON.stringify({
            threat_ids: threatIds || [],
            tools: surface?.tools || [],
            has_database: surface?.has_database || false,
            has_bash: surface?.has_bash || false,
            has_filesystem: surface?.has_filesystem || false,
            has_rag: surface?.has_rag || false,
            has_admin_tools: surface?.has_admin_tools || false,
            query: searchQuery.trim() || undefined,
            source: selectedSource || undefined,
          }),
        });

        if (res && res.status === "promoted") {
          toast("Threats Promoted to AttackLibrary", {
            description: `Generated and added ${res.promoted_count} attack templates.`,
            variant: "success",
          });
          return res;
        }
        return null;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to promote attack templates";
        toast("Promotion Failed", {
          description: msg,
          variant: "error",
        });
        return null;
      } finally {
        setPromoting(false);
      }
    },
    [searchQuery, selectedSource]
  );

  useEffect(() => {
    if (autoFetch) {
      void fetchMetrics();
      void fetchThreats();
    }
  }, [autoFetch, fetchMetrics, fetchThreats]);

  return {
    threats,
    metrics,
    loading,
    syncing,
    simulating,
    promoting,
    error,
    searchQuery,
    setSearchQuery,
    selectedSource,
    setSelectedSource,
    selectedCategory,
    setSelectedCategory,
    curateResult,
    setCurateResult,
    fetchThreats,
    fetchMetrics,
    syncLiveFeeds,
    simulateCurator,
    promoteThreats,
  };
}
