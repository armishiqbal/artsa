"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type GenericDetectionPoint = {
  round?: string;
  label?: string;
  artsa: number;
  baseline: number;
};

export function CommandCenterDetectionChart({
  series,
  className,
  activeRound,
  onSelectRound,
  dataMode = "DATA_VIEW",
}: {
  series: GenericDetectionPoint[];
  className?: string;
  liveRate?: number | boolean;
  activeRound?: number;
  onSelectRound?: (roundIdx: number) => void;
  dataMode?: "WALKTHROUGH" | "NO_LIVE_HISTORY" | "DATA_VIEW";
}) {
  const artsStroke = "#10b981"; // Emerald for Adaptive Defense
  const baseStroke = "#737373"; // Neutral gray for Static Baseline
  const gridStroke = "rgba(255, 255, 255, 0.07)";
  const tickFill = "#a3a3a3";
  const tooltipBg = "#0e0e0e";
  const tooltipBorder = "rgba(255, 255, 255, 0.12)";
  const tooltipText = "#ffffff";

  const chartData = series.map((pt, idx) => ({
    ...pt,
    round: pt.round ?? pt.label ?? `R${idx + 1}`,
    key: `${pt.round ?? pt.label ?? idx}-${idx}`,
  }));

  const activeRoundKey = useMemo(() => {
    if (activeRound == null) return null;
    const pt = chartData[activeRound - 1] ?? chartData.find((p) => p.round === `R${activeRound}`);
    return pt?.round ?? null;
  }, [activeRound, chartData]);

  // Compute adaptive lift over baseline for the latest recorded point
  const latestPoint = chartData[chartData.length - 1];
  const latestAdaptive = latestPoint?.artsa ?? 0;
  const latestBaseline = latestPoint?.baseline ?? 0;
  const adaptiveLift = Math.round((latestAdaptive - latestBaseline) * 10) / 10;

  return (
    <section
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-neutral-800 bg-[#0e0e0e] shadow-xl text-white",
        className
      )}
      aria-label="Detection rate trend"
    >
      {/* Top Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 bg-[#121212] px-4 py-3 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              DETECTION RATE HISTORY
            </p>
          </div>
          {chartData.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums">
              <span className="flex items-center gap-1.5 text-neutral-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Adaptive Defense: <strong className="text-white">{latestAdaptive}%</strong></span>
              </span>
              <span className="flex items-center gap-1.5 text-neutral-400">
                <span className="h-2 w-2 rounded-full bg-neutral-500" />
                <span>Static Baseline: <strong className="text-neutral-300">{latestBaseline}%</strong></span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {adaptiveLift > 0 ? (
            <span className="rounded-md border border-emerald-800/80 bg-emerald-950/50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
              +{adaptiveLift}pp Adaptive Lift
            </span>
          ) : null}
          <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
            {dataMode === "WALKTHROUGH"
              ? "Walkthrough sample"
              : dataMode === "NO_LIVE_HISTORY"
                ? "History unavailable"
                : "Data view"}
          </span>
        </div>
      </div>

      {dataMode === "NO_LIVE_HISTORY" ? (
        <div className="flex min-h-[260px] items-center justify-center px-6 py-8 text-center bg-[#070707]">
          <p className="max-w-sm font-mono text-xs leading-6 text-neutral-400">
            The live feed does not provide round-by-round detection history yet. Historical trend data will appear here when available.
          </p>
        </div>
      ) : (
        <>
          <div className="h-[260px] w-full min-w-0 px-3 pt-4 bg-[#090909]" data-testid="detection-chart-container">
            <ResponsiveContainer width="100%" height="100%" minHeight={220} minWidth={100}>
              <LineChart
                data={chartData}
                margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
                onClick={(state) => {
                  if (state && state.activeTooltipIndex != null) {
                    onSelectRound?.(state.activeTooltipIndex);
                  }
                }}
              >
                <CartesianGrid
                  stroke={gridStroke}
                  vertical={false}
                  strokeDasharray="2 2"
                />
                <XAxis
                  dataKey="round"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: tickFill, fontFamily: "ui-monospace, monospace" }}
                  dy={6}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: tickFill, fontFamily: "ui-monospace, monospace" }}
                  width={54}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontFamily: "ui-monospace, monospace",
                    color: tooltipText,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
                  }}
                  formatter={(value, name) => [
                    `${value}%`,
                    name === "artsa" ? "Adaptive Defense (climbing)" : "Static Baseline (control)",
                  ]}
                />
                {activeRoundKey ? (
                  <ReferenceLine
                    x={activeRoundKey}
                    stroke={artsStroke}
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                    label={{
                      value: "ACTIVE",
                      position: "insideTopRight",
                      fill: artsStroke,
                      fontSize: 9,
                      fontFamily: "ui-monospace, monospace",
                    }}
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="artsa"
                  name="artsa"
                  stroke={artsStroke}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4.5, fill: artsStroke, stroke: tooltipBg, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="baseline"
                  stroke={baseStroke}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Footnote Explaining Adaptive Lift */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 bg-[#0e0e0e] px-4 py-2.5 text-xs text-neutral-400 sm:px-5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px]">
              <span className="inline-flex items-center gap-2">
                <span className="h-1 w-3 bg-emerald-400 rounded-full" />
                <strong className="font-medium text-white">Adaptive Defense</strong> (Self-updating Defender)
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1 w-3 bg-neutral-500 rounded-full" />
                <strong className="font-medium text-neutral-300">Static Baseline</strong> (Non-updating control)
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-neutral-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Thesis: Closed-loop policy lift accelerates round over round</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
