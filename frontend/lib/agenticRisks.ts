/**
 * Agentic risk framework — labels and demo counters only.
 * Static Top 10 metadata is served by `/api/v1/risks` (backend JSON config).
 */

import { fetchFromBackend } from "@/lib/api";
import type { AgenticRisk, RiskFrameworkResponse } from "@/lib/types";
import { severityFromScore } from "@/lib/severity";

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

export async function loadRiskFrameworkWithDemoFallback(): Promise<{
  data: RiskFrameworkResponse | null;
  simulated: boolean;
}> {
  const res = await fetchFromBackend<RiskFrameworkResponse>("/api/v1/risks", { silent: true });
  if (res) {
    const demo = shouldUseSimulatedRiskDemo(res);
    return { data: demo ? withSimulatedRiskCounts(res) : res, simulated: demo };
  }

  const meta = await loadOfflineFrameworkMetadata();
  if (!meta) return { data: null, simulated: false };
  const empty = frameworkFromMetadata(meta);
  return { data: withSimulatedRiskCounts(empty), simulated: true };
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

/** Demo event counts keyed by risk id — overlaid when the pipeline is idle. */
const SIM_EVENTS: Record<string, { live: number; blocked: number; breached: number; score: number }> = {
  "agent-goal-hijack": { live: 47, blocked: 38, breached: 2, score: 91 },
  "tool-misuse-exploitation": { live: 31, blocked: 24, breached: 1, score: 84 },
  "identity-privilege-abuse": { live: 12, blocked: 10, breached: 0, score: 78 },
  "agentic-supply-chain": { live: 6, blocked: 5, breached: 0, score: 72 },
  "unexpected-code-execution": { live: 4, blocked: 4, breached: 0, score: 88 },
  "memory-context-poisoning": { live: 19, blocked: 15, breached: 1, score: 76 },
  "insecure-inter-agent-communication": { live: 9, blocked: 7, breached: 0, score: 69 },
  "cascading-failures": { live: 3, blocked: 3, breached: 0, score: 81 },
  "human-agent-trust-exploitation": { live: 22, blocked: 18, breached: 1, score: 74 },
  "rogue-agents": { live: 8, blocked: 6, breached: 1, score: 66 },
};

export function shouldUseSimulatedRiskDemo(res: RiskFrameworkResponse | null): boolean {
  if (!res || res.framework.length === 0) return true;
  if (res.total_events === 0) return true;
  const matched = res.framework.reduce((sum, row) => sum + row.live_events, 0);
  return matched === 0;
}

/** Apply demonstration counters onto API framework rows (structure stays from backend). */
export function withSimulatedRiskCounts(api: RiskFrameworkResponse): RiskFrameworkResponse {
  return {
    total_events: 161,
    generated_at: api.generated_at,
    framework: api.framework.map((row) => {
      const stats = SIM_EVENTS[row.id];
      if (!stats) return row;
      return {
        ...row,
        live_events: stats.live,
        blocked_events: stats.blocked,
        breached_events: stats.breached,
        max_risk_score: stats.score,
        severity: severityFromScore(stats.score),
      };
    }),
  };
}
