"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const LAYER_LABELS: Record<string, string> = {
  prompt_injection: "Injection",
  semantic: "Semantic",
  rule_based: "Rules",
  statistical: "Statistical",
  goal_drift: "Goal drift",
  trajectory: "Trajectory",
  rule_based_score: "Rules",
  semantic_score: "Semantic",
  statistical_score: "Statistical",
  injection_score: "Injection",
  goal_drift_score: "Goal drift",
  trajectory_score: "Trajectory",
  tool_output_score: "Tool output",
  canary_score: "Canary",
  sql_injection_score: "SQL",
  mcp_destructive_score: "MCP",
  policy_score: "Policy",
};

function extractLayerRows(evaluation: Record<string, unknown>): Array<{ label: string; value: number }> {
  const rows: Array<{ label: string; value: number }> = [];

  const layerScores = evaluation.layer_scores;
  if (layerScores && typeof layerScores === "object" && !Array.isArray(layerScores)) {
    for (const [key, val] of Object.entries(layerScores as Record<string, unknown>)) {
      const n = Number(val);
      if (Number.isFinite(n) && n > 0) {
        rows.push({ label: LAYER_LABELS[key] ?? key, value: n });
      }
    }
  }

  for (const [key, val] of Object.entries(evaluation)) {
    if (!key.endsWith("_score")) continue;
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (rows.some((r) => r.label === (LAYER_LABELS[key] ?? key))) continue;
    rows.push({ label: LAYER_LABELS[key] ?? key, value: n });
  }

  return rows.sort((a, b) => b.value - a.value).slice(0, 5);
}

/** Compact layer breakdown for session banners (logs / replay header). */
export function SessionLayerStrip({ evaluation }: { evaluation: Record<string, unknown> | null | undefined }) {
  if (!evaluation) return null;
  const rows = extractLayerRows(evaluation);
  if (rows.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Top detector layers
        </p>
        <Badge variant="secondary" className="text-[9px]">
          {String(evaluation.verdict ?? "—")}
        </Badge>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="space-y-0.5">
            <div className="flex justify-between font-mono text-[10px]">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="tabular-nums">{row.value.toFixed(0)}</span>
            </div>
            <Progress value={Math.min(100, row.value)} className="h-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
