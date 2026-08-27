import type { TranscriptTurn } from "@/lib/campaignTranscript";
import { deriveRoundSecurity } from "@/lib/liveMonitorSecurity";

export type MonitorSeriesPoint = {
  round: number;
  label: string;
  attackPct: number;
  defensePct: number;
  leakPct: number;
  bypass: number;
  latencyMs: number;
  durationMs: number;
  cumulativeRisk: number;
  blocked: number;
};

export type LayerFunnelRow = {
  layer: string;
  seen: number;
  passed: number;
  failed: number;
  failRate: number;
  avgLatencyMs: number;
};

export type CategoryAgg = {
  category: string;
  rounds: number;
  avgAttack: number;
  avgDefense: number;
  blocked: number;
  critical: number;
};

export type MonitorAnalytics = {
  series: MonitorSeriesPoint[];
  layers: LayerFunnelRow[];
  categories: CategoryAgg[];
  kpis: {
    n: number;
    meanAttack: number;
    meanDefense: number;
    meanLeak: number;
    meanLatencyMs: number;
    p95LatencyMs: number;
    blockRate: number;
    meanBypass: number;
    cumulativeRisk: number;
  };
};

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function percentile(nums: number[], p: number): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

/** Build monitor analytics from persisted rounds — no synthetic filler. */
export function buildMonitorAnalytics(turns: TranscriptTurn[]): MonitorAnalytics {
  const series: MonitorSeriesPoint[] = [];
  let riskAcc = 0;

  for (const t of turns) {
    const attackPct = Math.round(t.attackSuccessScore * 1000) / 10;
    const defensePct = Math.round(t.defenseQualityScore * 1000) / 10;
    const leakPct = Math.round(t.informationLeakageScore * 1000) / 10;
    // Risk contribution: high attack + low defense + leak pressure
    const step =
      t.attackSuccessScore * 0.55 +
      (1 - t.defenseQualityScore) * 0.25 +
      t.informationLeakageScore * 0.2;
    riskAcc += step;
    series.push({
      round: t.roundNumber,
      label: `R${t.roundNumber}`,
      attackPct,
      defensePct,
      leakPct,
      bypass: t.bypassDepth,
      latencyMs: Math.round(t.latencyMs || t.durationMs),
      durationMs: Math.round(t.durationMs),
      cumulativeRisk: Math.round(riskAcc * 100) / 100,
      blocked: t.blocked ? 1 : 0,
    });
  }

  const layerMap = new Map<
    string,
    { seen: number; passed: number; failed: number; latency: number[] }
  >();
  for (const t of turns) {
    for (const g of t.guardrailTrace) {
      const row = layerMap.get(g.layer) ?? { seen: 0, passed: 0, failed: 0, latency: [] };
      row.seen += 1;
      if (g.passed) row.passed += 1;
      else row.failed += 1;
      row.latency.push(g.latencyMs);
      layerMap.set(g.layer, row);
    }
  }
  const layers: LayerFunnelRow[] = [...layerMap.entries()].map(([layer, v]) => ({
    layer,
    seen: v.seen,
    passed: v.passed,
    failed: v.failed,
    failRate: v.seen ? Math.round((v.failed / v.seen) * 1000) / 10 : 0,
    avgLatencyMs: Math.round(mean(v.latency) * 10) / 10,
  }));

  const catMap = new Map<string, TranscriptTurn[]>();
  for (const t of turns) {
    const key = t.category || "UNK";
    const list = catMap.get(key) ?? [];
    list.push(t);
    catMap.set(key, list);
  }
  const categories: CategoryAgg[] = [...catMap.entries()].map(([category, rows]) => ({
    category,
    rounds: rows.length,
    avgAttack: Math.round(mean(rows.map((r) => r.attackSuccessScore)) * 1000) / 10,
    avgDefense: Math.round(mean(rows.map((r) => r.defenseQualityScore)) * 1000) / 10,
    blocked: rows.filter((r) => r.blocked).length,
    critical: rows.filter((r) => {
      const a = deriveRoundSecurity(r);
      return a?.result === "critical" || a?.result === "fail";
    }).length,
  }));

  const latencies = turns.map((t) => t.latencyMs || t.durationMs).filter((n) => n > 0);
  const n = turns.length;
  const blocked = turns.filter((t) => t.blocked).length;

  return {
    series,
    layers,
    categories,
    kpis: {
      n,
      meanAttack: Math.round(mean(turns.map((t) => t.attackSuccessScore)) * 1000) / 10,
      meanDefense: Math.round(mean(turns.map((t) => t.defenseQualityScore)) * 1000) / 10,
      meanLeak: Math.round(mean(turns.map((t) => t.informationLeakageScore)) * 1000) / 10,
      meanLatencyMs: Math.round(mean(latencies)),
      p95LatencyMs: Math.round(percentile(latencies, 95)),
      blockRate: n ? Math.round((blocked / n) * 1000) / 10 : 0,
      meanBypass: Math.round(mean(turns.map((t) => t.bypassDepth)) * 100) / 100,
      cumulativeRisk: series.length ? series[series.length - 1].cumulativeRisk : 0,
    },
  };
}
