"use client";

import { useAppData } from "@/lib/context/AppDataProvider";

export interface CampaignListItem {
  id: string;
  name: string;
  status: string;
  provider: string;
  model: string;
  rounds_completed: number;
  total_rounds: number;
  summary?: Record<string, unknown> | null;
  error?: string | null;
}

/** Campaign list from shared AppDataProvider — no duplicate polling per page. */
export function useCampaigns() {
  const { campaigns, campaignsLoading, refreshCampaigns } = useAppData();
  return {
    campaigns,
    loading: campaignsLoading,
    refresh: refreshCampaigns,
  };
}
