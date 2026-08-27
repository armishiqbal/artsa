"use client";

import dynamic from "next/dynamic";
import type { TranscriptTurn } from "@/lib/campaignTranscript";
import { buildMonitorAnalytics } from "@/lib/liveMonitorAnalytics";
import { KpiTile } from "@/components/red-team/KpiTile";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const DeepCharts = dynamic(() => import("@/components/red-team/LiveMonitorDeepCharts"), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] animate-pulse rounded-md border border-border bg-muted/20" />
  ),
});

/** Guardrail layer waterfall for the selected round — real trace only. */
export function GuardrailWaterfall({ turn }: { turn: TranscriptTurn | null }) {
  if (!turn || turn.guardrailTrace.length === 0) {
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center rounded-md border border-dashed border-border px-3 text-center text-[12px] text-muted-foreground">
        No guardrail_trace on this round
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Containment layers · R{turn.roundNumber}
        </p>
        <span className="font-mono text-[10px] text-muted-foreground">
          {turn.guardrailTrace.length} hops · {Math.round(turn.latencyMs || turn.durationMs)} ms
        </span>
      </div>
      <ol className="space-y-2">
        {turn.guardrailTrace.map((layer, i) => (
          <li key={`${layer.layer}-${i}`} className="flex items-stretch gap-2">
            <div className="flex w-6 flex-col items-center">
              <span
                className={cn(
                  "mt-1 h-2.5 w-2.5 rounded-full",
                  layer.passed
                    ? "bg-[hsl(var(--severity-low))]"
                    : "bg-[hsl(var(--severity-critical))] animate-pulse"
                )}
              />
              {i < turn.guardrailTrace.length - 1 ? (
                <span className="mt-1 w-px flex-1 bg-border" aria-hidden />
              ) : null}
            </div>
            <div
              className={cn(
                "min-w-0 flex-1 rounded-md border px-2.5 py-2",
                layer.passed
                  ? "border-border bg-muted/20"
                  : "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[12px] font-medium">{layer.layer}</p>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {layer.latencyMs.toFixed(1)} ms
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{layer.details}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LiveMonitorDeepPanel({
  turns,
  activeTurn,
}: {
  turns: TranscriptTurn[];
  activeTurn: TranscriptTurn | null;
}) {
  const analytics = useMemo(() => buildMonitorAnalytics(turns), [turns]);

  if (turns.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-10 text-center text-[13px] text-muted-foreground">
        Deep analytics populate when persisted rounds stream in.
      </div>
    );
  }

  const { kpis } = analytics;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Campaign telemetry
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Derived from GET /rounds — scores, latency, leakage, guardrail hops.
          </p>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">n={kpis.n}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <KpiTile label="μ attack" value={`${kpis.meanAttack}%`} tone="warning" />
        <KpiTile label="μ defense" value={`${kpis.meanDefense}%`} tone="success" />
        <KpiTile
          label="μ leak"
          value={`${kpis.meanLeak}%`}
          tone={kpis.meanLeak > 20 ? "critical" : "neutral"}
        />
        <KpiTile label="block rate" value={`${kpis.blockRate}%`} tone="success" />
        <KpiTile label="μ bypass" value={kpis.meanBypass} />
        <KpiTile label="μ latency" value={`${kpis.meanLatencyMs}ms`} />
        <KpiTile label="p95 latency" value={`${kpis.p95LatencyMs}ms`} />
        <KpiTile
          label="Σ risk"
          value={kpis.cumulativeRisk}
          tone={kpis.cumulativeRisk > 1.5 ? "critical" : "neutral"}
        />
      </div>

      <DeepCharts analytics={analytics} selectedRound={activeTurn?.roundNumber ?? null} />

      <div className="grid gap-3 lg:grid-cols-2">
        <GuardrailWaterfall turn={activeTurn} />

        <div className="rounded-md border border-border p-3">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Category aggregates
          </p>
          {analytics.categories.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No categories</p>
          ) : (
            <ul className="space-y-2">
              {analytics.categories.map((c) => (
                <li key={c.category} className="rounded-md border border-border/80 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] font-medium">{c.category}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {c.rounds}r · {c.blocked} blocked
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <div className="mb-0.5 flex justify-between text-[9px] text-muted-foreground">
                        <span>atk</span>
                        <span>{c.avgAttack}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                        <div
                          className="h-full bg-[hsl(var(--severity-critical))]"
                          style={{ width: `${Math.min(100, c.avgAttack)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-0.5 flex justify-between text-[9px] text-muted-foreground">
                        <span>def</span>
                        <span>{c.avgDefense}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                        <div
                          className="h-full bg-[hsl(var(--severity-low))]"
                          style={{ width: `${Math.min(100, c.avgDefense)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {activeTurn ? (
            <div className="mt-3 border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
              <p>
                R{activeTurn.roundNumber}
                {activeTurn.mitreAtlas ? ` · ${activeTurn.mitreAtlas}` : ""}
                {activeTurn.owaspLlm ? ` · ${activeTurn.owaspLlm}` : ""}
                {activeTurn.asiCode ? ` · ${activeTurn.asiCode}` : ""}
              </p>
              {activeTurn.timestamp ? <p className="mt-1">{activeTurn.timestamp}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
