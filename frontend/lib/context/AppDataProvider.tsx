"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchFromBackend } from "@/lib/api";
import type { CampaignListItem } from "@/lib/hooks/useCampaigns";

export interface PolicyRuleRow {
  name: string;
  pattern: string;
  event_type: string;
  severity: string;
  risk_score: number;
  description: string;
}

export interface PlaybookVersionEntry {
  version: number;
  rule_count: number;
  created_at: string;
  trigger: string;
  finding_id?: string | null;
  note?: string | null;
}

interface AppDataContextValue {
  campaigns: CampaignListItem[];
  campaignsLoading: boolean;
  refreshCampaigns: () => Promise<void>;
  policyRules: PolicyRuleRow[];
  playbookVersion: number;
  policyVersions: PlaybookVersionEntry[];
  policiesLoading: boolean;
  refreshPolicies: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

const POLL_MS = 30_000;

/** Single poll loop for campaigns + policies — dedupes duplicate fetches across pages. */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [policyRules, setPolicyRules] = useState<PolicyRuleRow[]>([]);
  const [playbookVersion, setPlaybookVersion] = useState(0);
  const [policyVersions, setPolicyVersions] = useState<PlaybookVersionEntry[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const inflight = useRef<Promise<void> | null>(null);

  const refreshCampaigns = useCallback(async () => {
    const data = await fetchFromBackend<{ campaigns?: CampaignListItem[] }>(
      "/api/v1/campaigns",
      { silent: true }
    );
    if (data?.campaigns) setCampaigns(data.campaigns);
    setCampaignsLoading(false);
  }, []);

  const refreshPolicies = useCallback(async () => {
    const [policies, versions] = await Promise.all([
      fetchFromBackend<{ rules?: PolicyRuleRow[]; playbook_version?: number }>(
        "/api/v1/policies",
        { silent: true }
      ),
      fetchFromBackend<{ current_version?: number; versions?: PlaybookVersionEntry[] }>(
        "/api/v1/policies/versions",
        { silent: true }
      ),
    ]);
    if (policies?.rules) setPolicyRules(policies.rules);
    setPlaybookVersion(
      policies?.playbook_version ?? versions?.current_version ?? policies?.rules?.length ?? 0
    );
    if (versions?.versions) setPolicyVersions(versions.versions);
    setPoliciesLoading(false);
  }, []);

  const refreshAll = useCallback(async () => {
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      await Promise.all([refreshCampaigns(), refreshPolicies()]);
    })().finally(() => {
      inflight.current = null;
    });
    return inflight.current;
  }, [refreshCampaigns, refreshPolicies]);

  useEffect(() => {
    void refreshAll();
    const id = window.setInterval(refreshAll, POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshAll]);

  return (
    <AppDataContext.Provider
      value={{
        campaigns,
        campaignsLoading,
        refreshCampaigns,
        policyRules,
        playbookVersion,
        policyVersions,
        policiesLoading,
        refreshPolicies,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}
