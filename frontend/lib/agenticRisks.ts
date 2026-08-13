/**
 * Agentic risk framework — labels and live counters.
 * Static Top 10 metadata is served by `/api/v1/risks` (backend JSON config);
 * counters are real backend tallies only (no simulated overlay).
 */

import { fetchFromBackend } from "@/lib/api";
import type { AgenticRisk, RiskFrameworkResponse } from "@/lib/types";

export type { AgenticRisk, RiskFrameworkResponse };

type FrameworkMetaRow = {
  id: string;
  rank: number;
  name: string;
  description: string;
  attack_categories: string[];
  defense_layers: string[];
  detectors: string[];
  mitigations: string[];
};

/** Build a zero-count API response from static framework metadata (offline / API down). */
export function frameworkFromMetadata(meta: FrameworkMetaRow[]): RiskFrameworkResponse {
  return {
    framework: meta.map((row) => ({
      ...row,
      live_events: 0,
      blocked_events: 0,
      breached_events: 0,
      max_risk_score: 0,
      severity: "LOW" as AgenticRisk["severity"],
    })),
    total_events: 0,
    generated_at: null,
  };
}

async function loadOfflineFrameworkMetadata(): Promise<FrameworkMetaRow[] | null> {
  try {
    const res = await fetch("/agentic_risk_framework.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as FrameworkMetaRow[];
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** Load the risk framework from the backend (real counters); fall back to
 * zero-count static metadata only when the API is unreachable. */
export async function loadRiskFramework(): Promise<RiskFrameworkResponse | null> {
  const res = await fetchFromBackend<RiskFrameworkResponse>("/api/v1/risks", { silent: true });
  if (res) return res;

  const meta = await loadOfflineFrameworkMetadata();
  if (!meta) return null;
  return frameworkFromMetadata(meta);
}

export const DEFENSE_LAYER_LABELS: Record<string, string> = {
  tool_validator: "Tool Validator",
  statistical_inspector: "Statistical Inspector",
  goal_drift_classifier: "Goal Drift Classifier",
  containment_enforcer: "Containment Enforcer",
};

export const DEFENSE_LAYER_COUNT = Object.keys(DEFENSE_LAYER_LABELS).length;

export const CATEGORY_LABELS: Record<string, string> = {
  DPI: "Direct Prompt Injection",
  IPI: "Indirect Prompt Injection",
  JBK: "Jailbreak",
  SPE: "System Prompt Extraction",
  DEX: "Data Extraction",
  PEX: "Privilege Escalation",
  DOS: "Denial of Service",
  OPM: "Output Manipulation",
  MSE: "Social Engineering",
  TPA: "Tool Abuse",
};
