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
import { CHART_AXIS_TICK, CHART_GRID, CHART_TOOLTIP_PROPS } from "@/lib/chartTheme";
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
      {/* Six-agent attack launch path */}
      <div className="rounded-lg border border-neutral-800 bg-[#0e0e0e] p-3.5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              Six-Agent Autonomous Attack Chain
            </h3>
            <span className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.2 font-mono text-[10px] text-neutral-400">
              HMAC Custody Passing
            </span>
          </div>
          <span className="font-mono text-[10px] text-neutral-500">
            {model.idle
              ? "waiting"
              : model.latestRound != null
                ? `round ${model.latestRound}`
                : "live"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {model.path.map((node, i) => (
            <div key={node.id} className="min-w-0">
              <div
                className={cn(
                  "w-full rounded-md border p-2.5 transition-colors relative",
                  node.active
                    ? node.hot
                      ? "border-rose-800/60 bg-rose-950/30"
                      : "border-neutral-700 bg-neutral-900"
                    : "border-neutral-800/60 bg-[#080808] opacity-50"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[9px] font-bold text-neutral-500">
                    Hop {i + 1}
                  </span>
                  {node.hmacVerified ? (
                    <span className="rounded border border-emerald-800/50 bg-emerald-950/60 px-1 py-0.2 font-mono text-[9px] font-bold text-emerald-400">
                      HMAC
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-semibold text-[11px] text-white truncate">
                  {node.label}
                </p>
                {node.role ? (
                  <p className="text-[10px] text-neutral-400 truncate">
                    {node.role}
                  </p>
                ) : null}
                <p
                  className={cn(
                    "mt-1 truncate font-mono text-[10px]",
                    node.hot ? "text-rose-400 font-semibold" : "text-neutral-500"
                  )}
                  title={node.detail}
                >
                  {node.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
        {model.latestAttack ? (
          <p className="mt-2.5 truncate font-mono text-[11px] text-neutral-500">
            Latest probe: <span className="text-neutral-300">{model.latestAttack}</span>
          </p>
        ) : null}
      </div>

      {/* Round pulse rail */}
      <div className="rounded-lg border border-neutral-800 bg-[#0e0e0e] p-3.5">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-400">
          <span>Round timeline</span>
          <span className="font-mono tabular-nums text-neutral-500">{model.rounds.length} rounds</span>
        </div>
        {model.rounds.length === 0 ? (
          <div className="flex h-14 items-center justify-center rounded-md border border-dashed border-neutral-800 bg-[#070707] text-[12px] text-neutral-500">
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
                      "border-rose-900/60 bg-rose-950/30 text-rose-300",
                    tone === "ok" &&
                      "border-emerald-900/60 bg-emerald-950/30 text-emerald-300",
                    tone === "warn" &&
                      "border-amber-900/60 bg-amber-950/30 text-amber-300",
                    tone === "idle" && "border-neutral-800 bg-neutral-900/40 text-neutral-500",
                    active && "scale-[1.03] ring-2 ring-white/60",
                    r.round === model.latestRound && "animate-pulse"
                  )}
                  aria-pressed={active}
                >
                  <span
                    className={cn(
                      "absolute top-1.5 h-2 w-2 rounded-full",
                      tone === "bad" && "bg-rose-500",
                      tone === "ok" && "bg-emerald-500",
                      tone === "warn" && "bg-amber-500",
                      tone === "idle" && "bg-neutral-600"
                    )}
                  />
                  <span className="font-mono text-[10px] tabular-nums">R{r.round}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cumulative outcomes chart + counts */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <div className="rounded-lg border border-neutral-800 bg-[#0e0e0e] p-3.5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
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
                    stroke="#10b981"
                    fill="#10b981"
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
                    stroke="#f43f5e"
                    fill="#f43f5e"
                    fillOpacity={0.4}
                    name="Breached"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[140px] items-center justify-center text-[12px] text-neutral-500">
              Outcomes stack as rounds finish.
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-neutral-800 bg-[#0e0e0e] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Scoreboard
          </p>
          <ul className="mt-3 space-y-2 font-mono text-[12px]">
            <li className="flex justify-between">
              <span className="text-emerald-400">Blocked</span>
              <span className="text-white">{model.outcomeCounts.pass}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-rose-400">Breached</span>
              <span className="text-white">{model.outcomeCounts.fail}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-amber-400">Flagged</span>
              <span className="text-white">{model.outcomeCounts.flag}</span>
            </li>
          </ul>
          {model.latestVerdict ? (
            <p className="mt-3 border-t border-neutral-800 pt-2 text-[10px] text-neutral-500">
              {model.latestVerdict}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
