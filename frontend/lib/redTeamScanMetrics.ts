import type { TranscriptTurn } from "@/lib/campaignTranscript";
import { buildCategoryRiskProfile, overallRiskBand, type RiskBand } from "@/lib/redTeamRiskProfile";

export function isScanFinding(turn: TranscriptTurn): boolean {
  const v = turn.verdict.toUpperCase();
  return v.includes("SUCCESS") || v.includes("PARTIAL") || turn.attackSuccessScore >= 5;
}

export function countFindings(turns: TranscriptTurn[]): number {
  return turns.filter(isScanFinding).length;
}

function num(value: unknown, digits = 1): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

export interface ScanMetrics {
  findingsCount: number;
  roundsCompleted: number;
  avgAttackSuccess: string;
  avgDefenseQuality: string;
  avgBypassDepth: string;
  blockedCount: number;
  successCount: number;
  /** Target API/billing failures — not security blocks. */
  errorCount: number;
  riskBand: RiskBand;
  verdicts: Record<string, number>;
}

/** Derive scan KPIs from summary + live transcript. */
export function deriveScanMetrics(
  summary: Record<string, unknown> | null | undefined,
  turns: TranscriptTurn[]
): ScanMetrics {
  const findingsCount = countFindings(turns);
  const riskRows = buildCategoryRiskProfile(turns);
  const riskBand = overallRiskBand(riskRows);

  const verdictsRaw = (summary?.results_by_verdict as Record<string, unknown>) ?? {};
  const verdicts: Record<string, number> = {};
  for (const [k, v] of Object.entries(verdictsRaw)) {
    verdicts[k] = Number(v) || 0;
  }

  if (Object.keys(verdicts).length === 0 && turns.length > 0) {
    for (const turn of turns) {
      const key = turn.verdict.toUpperCase();
      verdicts[key] = (verdicts[key] ?? 0) + 1;
    }
  }

  const blockedCount = turns.filter((t) => {
    const v = t.verdict.toUpperCase();
    if (v.includes("ERROR") || t.targetError) return false;
    return t.blocked || v.includes("BLOCKED");
  }).length;
  const successCount = turns.filter((t) => t.verdict.toUpperCase().includes("SUCCESS")).length;
  const errorCount = turns.filter(
    (t) => t.targetError || t.verdict.toUpperCase().includes("ERROR")
  ).length;

  const roundsCompleted = Number(summary?.completed_rounds ?? summary?.total_rounds ?? turns.length) || turns.length;

  return {
    findingsCount,
    roundsCompleted,
    avgAttackSuccess: num(summary?.avg_attack_success),
    avgDefenseQuality: num(summary?.avg_defense_quality),
    avgBypassDepth: num(summary?.avg_bypass_depth),
    blockedCount,
    successCount,
    errorCount,
    riskBand,
    verdicts,
  };
}
