"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_AXIS_TICK, CHART_CRITICAL, CHART_GRID, CHART_TOOLTIP_PROPS } from "@/lib/chartTheme";
import type { CampaignAttackVizModel } from "@/lib/campaignAttackViz";
import { cn } from "@/lib/utils";

/** Live visualization of agents attacking during a campaign launch. */
export function CampaignAttackViz({
  model,
  selectedRound,
  onSelectRound,
  className,
}: {
  model: CampaignAttackVizModel;
  selectedRound?: number | null;
  onSelectRound?: (round: number) => void;
  className?: string;
}) {
  const activeRound = selectedRound ?? model.latestRound;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Kill-chain path */}
      <div className="rounded-md border border-border p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Attack launch path
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground">
            {model.idle
              ? "waiting"
              : model.latestRound != null
                ? `round ${model.latestRound}`
                : "live"}
          </span>
        </div>
        <div className="flex flex-wrap items-stretch gap-1 sm:flex-nowrap">
          {model.path.map((node, i) => (
            <div key={node.id} className="flex min-w-0 flex-1 items-center gap-1">
              <div
                className={cn(
                  "w-full rounded-md border px-2.5 py-2.5 transition-colors",
                  node.active
                    ? node.hot
                      ? "border-[hsl(var(--severity-critical))]/50 bg-[hsl(var(--severity-critical))]/10"
                      : "border-foreground/20 bg-muted/40"
                    : "border-border/60 opacity-45"
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {node.label}
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate font-mono text-[11px]",
                    node.hot ? "text-[hsl(var(--severity-critical))]" : "text-foreground"
                  )}
                >
                  {node.detail}
                </p>
              </div>
              {i < model.path.length - 1 ? (
                <span
                  className={cn(
                    "hidden shrink-0 sm:inline",
                    node.hot ? "animate-pulse text-[hsl(var(--severity-critical))]" : "text-muted-foreground"
                  )}
                  aria-hidden
                >
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {model.latestAttack ? (
          <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
            Latest probe: <span className="text-foreground">{model.latestAttack}</span>
          </p>
        ) : null}
      </div>

      {/* Round pulse rail */}
      <div className="rounded-md border border-border p-3">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Round timeline</span>
          <span className="font-mono tabular-nums">{model.rounds.length} rounds</span>
        </div>
        {model.rounds.length === 0 ? (
          <div className="flex h-14 items-center justify-center rounded-md border border-dashed border-border text-[12px] text-muted-foreground">
            Waiting for Red Team to launch the first attack…
          </div>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {model.rounds.map((r) => {
              const tone =
                r.outcome === "fail" ? "bad" : r.outcome === "pass" ? "ok" : r.outcome === "flag" ? "warn" : "idle";
              const active = r.round === activeRound;
              return (
                <button
                  key={r.round}
                  type="button"
                  onClick={() => onSelectRound?.(r.round)}
                  title={r.summary}
                  className={cn(
                    "relative flex h-12 min-w-[2.75rem] flex-1 flex-col items-center justify-end rounded-md border px-1 pb-1.5 pt-2 transition-transform",
                    tone === "bad" &&
                      "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))]",
                    tone === "ok" &&
                      "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))]",
                    tone === "warn" &&
                      "border-[hsl(var(--severity-medium-border))] bg-[hsl(var(--severity-medium-subtle))]",
                    tone === "idle" && "border-border bg-muted/20",
                    active && "scale-[1.03] ring-2 ring-foreground/40",
                    r.round === model.latestRound && "animate-pulse"
                  )}
                  aria-pressed={active}
                >
                  <span
                    className={cn(
                      "absolute top-1.5 h-2 w-2 rounded-full",
                      tone === "bad" && "bg-[hsl(var(--severity-critical))]",
                      tone === "ok" && "bg-[hsl(var(--severity-low))]",
                      tone === "warn" && "bg-[hsl(var(--severity-medium))]",
                      tone === "idle" && "bg-muted-foreground/40"
                    )}
                  />
                  <span className="font-mono text-[10px] tabular-nums text-foreground">R{r.round}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cumulative outcomes chart + counts */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <div className="rounded-md border border-border p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Cumulative outcomes
          </h3>
          {model.hopSeries.length >= 1 ? (
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={model.hopSeries} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="round" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip {...CHART_TOOLTIP_PROPS} />
                  <Area
                    type="monotone"
                    dataKey="pass"
                    stackId="1"
                    stroke="hsl(var(--severity-low))"
                    fill="hsl(var(--severity-low))"
                    fillOpacity={0.35}
                    name="Blocked"
                  />
                  <Area
                    type="monotone"
                    dataKey="flag"
                    stackId="1"
                    stroke="#e8a838"
                    fill="#e8a838"
                    fillOpacity={0.3}
                    name="Flagged"
                  />
                  <Area
                    type="monotone"
                    dataKey="fail"
                    stackId="1"
                    stroke={CHART_CRITICAL}
                    fill={CHART_CRITICAL}
                    fillOpacity={0.4}
                    name="Breached"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[140px] items-center justify-center text-[12px] text-muted-foreground">
              Outcomes stack as rounds finish.
            </div>
          )}
        </div>

        <aside className="rounded-md border border-border px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Scoreboard
          </p>
          <ul className="mt-3 space-y-2 font-mono text-[12px]">
            <li className="flex justify-between">
              <span className="text-[hsl(var(--severity-low))]">Blocked</span>
              <span>{model.outcomeCounts.pass}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-[hsl(var(--severity-critical))]">Breached</span>
              <span>{model.outcomeCounts.fail}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-[hsl(var(--severity-medium))]">Flagged</span>
              <span>{model.outcomeCounts.flag}</span>
            </li>
          </ul>
          {model.latestVerdict ? (
            <p className="mt-3 border-t border-border pt-2 text-[10px] text-muted-foreground">
              {model.latestVerdict}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
