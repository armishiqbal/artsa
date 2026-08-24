/**
 * Normalise campaign round payloads into Red Team Console transcript turns.
 */

import { asiForAttackCategory } from "@/lib/asiCategories";

export interface TranscriptTurn {
  roundNumber: number;
  attackPrompt: string;
  attackName: string;
  category: string;
  asiCode: string | null;
  asiLabel: string | null;
  targetResponse: string;
  blocked: boolean;
  blockedBy: string | null;
  verdict: string;
  attackSuccessScore: number;
  defenseQualityScore: number;
  bypassDepth: number;
  reasoning: string;
  severity: string;
}

function dig(obj: Record<string, unknown>, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function roundToTranscriptTurn(raw: Record<string, unknown>): TranscriptTurn {
  const attack = (raw.attack as Record<string, unknown>) ?? {};
  const response = (raw.response as Record<string, unknown>) ?? {};
  const score = (raw.score as Record<string, unknown>) ?? {};

  const category = String(attack.category ?? "");
  const asi = asiForAttackCategory(category);

  return {
    roundNumber: Number(raw.round_number ?? 0),
    attackPrompt: String(attack.prompt ?? ""),
    attackName: String(attack.name ?? "Attack"),
    category,
    asiCode: asi?.code ?? null,
    asiLabel: asi?.label ?? null,
    targetResponse: String(response.response ?? response.raw_response ?? ""),
    blocked: Boolean(response.blocked),
    blockedBy: response.blocked_by ? String(response.blocked_by) : null,
    verdict: String(score.verdict ?? "UNKNOWN"),
    attackSuccessScore: Number(score.attack_success_score ?? 0),
    defenseQualityScore: Number(score.defense_quality_score ?? 0),
    bypassDepth: Number(score.bypass_depth ?? 0),
    reasoning: String(score.reasoning ?? ""),
    severity: String(score.severity ?? "MEDIUM"),
  };
}

export function topFindingToTurn(raw: Record<string, unknown>): TranscriptTurn {
  return roundToTranscriptTurn(raw);
}

export function pickFeaturedTurn(turns: TranscriptTurn[]): TranscriptTurn | null {
  if (!turns.length) return null;
  return (
    turns.find((t) => t.verdict.toUpperCase().includes("SUCCESS")) ??
    turns.find((t) => t.verdict.toUpperCase().includes("PARTIAL")) ??
    turns[turns.length - 1]
  );
}

export function parseTopFindings(summary: Record<string, unknown> | null | undefined): TranscriptTurn[] {
  const rows = summary?.top_findings;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map(topFindingToTurn);
}
