/**
 * Normalise campaign round payloads into Red Team Console transcript turns.
 * Scores are always 0–1 for downstream security math and gauges.
 */

import { asiForAttackCategory } from "@/lib/asiCategories";

export type GuardrailLayerEvent = {
  layer: string;
  passed: boolean;
  details: string;
  latencyMs: number;
};

export interface TranscriptTurn {
  roundNumber: number;
  attackPrompt: string;
  attackName: string;
  category: string;
  asiCode: string | null;
  asiLabel: string | null;
  /** Attack library template id that seeded this probe (if any). */
  templateId: string | null;
  /** What the red team was trying to achieve this round. */
  objective: string | null;
  /** Mutations applied after template render (encoding, obfuscation, etc.). */
  mutationsApplied: string[];
  targetResponse: string;
  blocked: boolean;
  blockedBy: string | null;
  /** Target LLM/API infrastructure failure — not a security block. */
  targetError: boolean;
  errorDetail: string | null;
  verdict: string;
  /** 0–1 */
  attackSuccessScore: number;
  /** 0–1 */
  defenseQualityScore: number;
  bypassDepth: number;
  reasoning: string;
  severity: string;
  /** ISO timestamp from results store when present. */
  timestamp: string | null;
  /** End-to-end round duration (ms). */
  durationMs: number;
  /** Target / pipeline latency (ms). */
  latencyMs: number;
  /** 0–1 information leakage from judge score. */
  informationLeakageScore: number;
  mitreAtlas: string | null;
  owaspLlm: string | null;
  /** Ordered containment layers from guardrail_trace. */
  guardrailTrace: GuardrailLayerEvent[];
}

function asRecord(obj: unknown): Record<string, unknown> | null {
  return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
}

/** Backend stores many scores on 0–10; normalize to 0–1. */
export function score01(raw: unknown): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n)) return 0;
  if (n > 1) return Math.max(0, Math.min(1, n / 10));
  return Math.max(0, Math.min(1, n));
}

function parseGuardrailTrace(raw: unknown): GuardrailLayerEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .map((row) => ({
      layer: String(row.layer ?? "UNKNOWN"),
      passed: Boolean(row.passed),
      details: String(row.details ?? ""),
      latencyMs: Number(row.latency_ms ?? 0) || 0,
    }));
}

export function roundToTranscriptTurn(raw: Record<string, unknown>): TranscriptTurn {
  const attack = asRecord(raw.attack) ?? {};
  const response = asRecord(raw.response) ?? {};
  const score = asRecord(raw.score) ?? {};
  const metadata = asRecord(attack.metadata) ?? {};

  const category = String(attack.category ?? "");
  const asi = asiForAttackCategory(category);

  const mutationsRaw = attack.mutations_applied;
  const mutationsApplied = Array.isArray(mutationsRaw)
    ? mutationsRaw.map((m) => String(m)).filter(Boolean)
    : [];

  const targetResponse = String(response.response ?? response.raw_response ?? "");
  const detailsFromTrace = parseGuardrailTrace(response.guardrail_trace);
  const failedLayer = detailsFromTrace.find((l) => !l.passed);

  return {
    roundNumber: Number(raw.round_number ?? 0),
    attackPrompt: String(attack.prompt ?? ""),
    attackName: String(attack.name ?? "Attack"),
    category,
    asiCode: asi?.code ?? null,
    asiLabel: asi?.label ?? null,
    templateId: attack.template_id ? String(attack.template_id) : null,
    objective: attack.objective ? String(attack.objective) : null,
    mutationsApplied,
    targetResponse,
    blocked: Boolean(response.blocked),
    blockedBy: response.blocked_by ? String(response.blocked_by) : null,
    targetError: Boolean(response.error) || /GENERATION ERROR/i.test(targetResponse),
    errorDetail:
      response.error_detail
        ? String(response.error_detail)
        : failedLayer && !failedLayer.passed
          ? failedLayer.details
          : null,
    verdict: String(score.verdict ?? "UNKNOWN"),
    attackSuccessScore: score01(score.attack_success_score),
    defenseQualityScore: score01(score.defense_quality_score),
    bypassDepth: Number(score.bypass_depth ?? response.bypass_depth ?? 0) || 0,
    reasoning: String(score.reasoning ?? ""),
    severity: String(score.severity ?? metadata.severity ?? "MEDIUM"),
    timestamp: raw.timestamp ? String(raw.timestamp) : null,
    durationMs: Number(raw.duration_ms ?? 0) || 0,
    latencyMs: Number(response.latency_ms ?? 0) || 0,
    informationLeakageScore: score01(score.information_leakage_score),
    mitreAtlas:
      score.mitre_atlas_mapping
        ? String(score.mitre_atlas_mapping)
        : metadata.mitre_atlas
          ? String(metadata.mitre_atlas)
          : null,
    owaspLlm:
      score.owasp_llm_mapping
        ? String(score.owasp_llm_mapping)
        : metadata.owasp_llm
          ? String(metadata.owasp_llm)
          : null,
    guardrailTrace: detailsFromTrace,
  };
}

export function topFindingToTurn(raw: Record<string, unknown>): TranscriptTurn {
  return roundToTranscriptTurn(raw);
}

export function pickFeaturedTurn(turns: TranscriptTurn[]): TranscriptTurn | null {
  if (!turns.length) return null;
  const scored = turns.filter((t) => !t.verdict.toUpperCase().includes("ERROR"));
  const pool = scored.length ? scored : turns;
  return (
    pool.find((t) => t.verdict.toUpperCase().includes("SUCCESS")) ??
    pool.find((t) => t.verdict.toUpperCase().includes("PARTIAL")) ??
    pool[pool.length - 1]
  );
}

export function parseTopFindings(summary: Record<string, unknown> | null | undefined): TranscriptTurn[] {
  const rows = summary?.top_findings;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map(topFindingToTurn);
}
