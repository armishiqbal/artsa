/** Attack Lab live actions — call real ARTSA APIs (probe + campaign launch). */

import { fetchFromBackend } from "@/lib/api";

export type LabProbeResult = {
  classification?: {
    situation?: string;
    tool_name?: string;
    agent_id?: string;
    arguments?: Record<string, unknown>;
    confidence?: number;
    reason?: string;
    source?: string;
  };
  ingest_event?: {
    session_id?: string;
    tool_name?: string;
    agent_id?: string;
    arguments?: Record<string, unknown>;
  };
  risk_score?: { overall_score?: number; flags?: string[] };
  verdict?: {
    verdict?: string;
    recommended_action?: string;
    reasoning?: string;
    confidence?: number;
  };
  persisted?: boolean;
  logs_href?: string;
  note?: string;
};

export type LabProbeOutcome = {
  ok: boolean;
  latencyMs: number;
  result: LabProbeResult | null;
  error: string | null;
  /** Why this probe was fired (UI context). */
  reason: string;
};

/** Live single-message containment probe via /api/v1/situations/evaluate. */
export async function runLabProbe(
  message: string,
  opts?: {
    persist?: boolean;
    useLlm?: boolean;
    reason?: string;
  }
): Promise<LabProbeOutcome> {
  const reason = opts?.reason ?? "manual probe";
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      ok: false,
      latencyMs: 0,
      result: null,
      error: "Empty message — write an attack message first.",
      reason,
    };
  }

  const start = performance.now();
  const data = await fetchFromBackend<LabProbeResult>("/api/v1/situations/evaluate", {
    method: "POST",
    body: JSON.stringify({
      message: trimmed,
      persist: opts?.persist ?? true,
      use_llm: opts?.useLlm ?? false,
    }),
    timeoutMs: 45_000,
  });
  const latencyMs = Math.round(performance.now() - start);

  if (!data) {
    return {
      ok: false,
      latencyMs,
      result: null,
      error: "Couldn’t reach ARTSA — check that you’re signed in and the service is online.",
      reason,
    };
  }

  return { ok: true, latencyMs, result: data, error: null, reason };
}

export type LabLaunchResult = {
  ok: boolean;
  campaignId: string | null;
  message: string | null;
  error: string | null;
};

/** Launch a Lab · campaign via /api/v1/campaigns/baseline. */
export async function launchLabCampaign(body: {
  name: string;
  maxRounds: number;
  categories: string[];
  intensity: string;
  mutationsEnabled: boolean;
  maxMutations: number;
}): Promise<LabLaunchResult> {
  const res = await fetchFromBackend<{ campaign_id?: string; message?: string; error?: string }>(
    "/api/v1/campaigns/baseline",
    {
      method: "POST",
      body: JSON.stringify({
        name: body.name,
        max_rounds: body.maxRounds,
        use_llm_judge: false,
        categories: body.categories,
        intensity: body.intensity,
        mutations_enabled: body.mutationsEnabled,
        max_mutations_per_attack: body.maxMutations,
      }),
      timeoutMs: 20_000,
    }
  );

  if (!res?.campaign_id) {
    return {
      ok: false,
      campaignId: null,
      message: null,
      error: res?.error || "Add a target provider under Settings → Integrations, then try again.",
    };
  }

  return {
    ok: true,
    campaignId: res.campaign_id,
    message: res.message ?? null,
    error: null,
  };
}

export function probeRisk(result: LabProbeResult | null): number | null {
  if (!result?.risk_score) return null;
  const n = Number(result.risk_score.overall_score);
  return Number.isFinite(n) ? Math.round(n) : null;
}
