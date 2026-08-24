"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const LAYER_FIELDS: Array<{ key: string; label: string }> = [
  { key: "rule_based_score", label: "Rule inspector" },
  { key: "semantic_score", label: "Semantic" },
  { key: "statistical_score", label: "Statistical" },
  { key: "goal_drift_score", label: "Goal drift" },
  { key: "injection_score", label: "Injection" },
  { key: "trajectory_score", label: "Trajectory" },
  { key: "tool_output_score", label: "Tool output" },
  { key: "canary_score", label: "Canary net" },
  { key: "sql_injection_score", label: "SQL guard" },
  { key: "mcp_destructive_score", label: "MCP destructive" },
  { key: "policy_score", label: "Policy" },
];

export function ReplayLayerScores({ evaluation }: { evaluation: Record<string, unknown> }) {
  const rows = LAYER_FIELDS
    .map(({ key, label }) => ({
      label,
      value: Number(evaluation[key]),
    }))
    .filter((r) => Number.isFinite(r.value) && r.value > 0);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No layer scores for this event yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="tabular-nums text-foreground">{row.value.toFixed(1)}</span>
          </div>
          <Progress
            value={Math.min(100, row.value)}
            className={cn("h-1.5", row.value >= 80 && "[&>div]:bg-severity-critical")}
          />
        </div>
      ))}
    </div>
  );
}
