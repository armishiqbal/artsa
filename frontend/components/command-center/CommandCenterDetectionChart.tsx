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
import { useThemeSafe } from "@/lib/context/ThemeProvider";

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
  const { isLight } = useThemeSafe();

  const artsStroke = isLight ? "#0284c7" : "#38bdf8";
  const baseStroke = isLight ? "#94a3b8" : "#64748b";
  const gridStroke = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)";
  const tickFill = isLight ? "#64748b" : "#94a3b8";
  const tooltipBg = isLight ? "#ffffff" : "#0d1117";
  const tooltipBorder = isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)";
  const tooltipText = isLight ? "#0f172a" : "#f8fafc";

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

  return (
    <section className={`w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs ${className ?? ""}`} aria-label="Detection rate trend">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-semibold text-foreground">
            DETECTION RATE HISTORY
          </p>
          {chartData.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums lowercase mt-1">
            <span className="flex items-center gap-1.5 text-foreground">
              <span className="text-sky-500 font-bold">●</span>
              <span className="text-muted-foreground">ARTSA</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="text-slate-400 font-bold">●</span>
              <span>Baseline</span>
            </span>
          </div>
          )}
        </div>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {dataMode === "WALKTHROUGH" ? "Walkthrough sample" : dataMode === "NO_LIVE_HISTORY" ? "History unavailable" : "Data view"}
        </span>
      </div>

      {dataMode === "NO_LIVE_HISTORY" ? (
        <div className="flex min-h-[260px] items-center justify-center px-6 py-8 text-center">
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            The live feed does not provide round-by-round detection history yet. Historical trend data will appear here when available.
          </p>
        </div>
      ) : (
      <>
      <div className="h-[260px] w-full min-w-0 px-3 pt-4" data-testid="detection-chart-container">
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
              strokeDasharray=""
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
                borderRadius: "8px",
                fontSize: "11px",
                fontFamily: "ui-monospace, monospace",
                color: tooltipText,
                boxShadow: isLight ? "0 4px 12px rgba(0,0,0,0.1)" : "0 8px 24px rgba(0,0,0,0.6)",
              }}
              formatter={(value, name) => [
                `${value}%`,
                name === "artsa" ? "ARTSA adaptive defense" : "Static baseline",
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
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: artsStroke, stroke: tooltipBg, strokeWidth: 1.5 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="baseline"
              name="baseline"
              stroke={baseStroke}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs text-muted-foreground sm:px-5">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 bg-sky-500 rounded-full" />
            <strong className="font-medium text-slate-900">ARTSA Closed-Loop Defense</strong> (Adaptive rule learning)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 bg-slate-400 rounded-full" />
            <strong className="font-medium text-slate-700">Static Baseline</strong> (Unpatched target)
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-500">
          Core Thesis: Closed-loop defense elevates detection per round against mutating adversarial prompts
        </span>
      </div>
      </>
      )}
    </section>
  );
}
