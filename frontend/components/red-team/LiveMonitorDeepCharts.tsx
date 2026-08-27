"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonitorAnalytics } from "@/lib/liveMonitorAnalytics";
import { CHART_AXIS_TICK, CHART_CRITICAL, CHART_GRID, CHART_PRIMARY, CHART_TOOLTIP_PROPS } from "@/lib/chartTheme";

const CHART_DEFENSE = "hsl(var(--severity-low))";
const CHART_LEAK = "hsl(var(--severity-medium))";
const CHART_LAT = "#a78bfa";

export default function LiveMonitorDeepCharts({
  analytics,
  selectedRound,
}: {
  analytics: MonitorAnalytics;
  selectedRound: number | null;
}) {
  const { series, layers } = analytics;
  const marked = series.map((p) => ({
    ...p,
    selected: selectedRound === p.round ? p.attackPct : undefined,
  }));

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <div className="rounded-md border border-border p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Attack · defense · leak by round
        </p>
        <div className="h-[240px] w-full" role="img" aria-label="Score series by round">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={marked} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={32}
                unit="%"
              />
              <Tooltip {...CHART_TOOLTIP_PROPS} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#7c7c7c" }} />
              <Area
                type="monotone"
                dataKey="leakPct"
                name="Leak"
                fill={CHART_LEAK}
                stroke={CHART_LEAK}
                fillOpacity={0.15}
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey="attackPct"
                name="Attack"
                stroke={CHART_CRITICAL}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="defensePct"
                name="Defense"
                stroke={CHART_DEFENSE}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-md border border-border p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Latency + cumulative risk
        </p>
        <div className="h-[240px] w-full" role="img" aria-label="Latency and cumulative risk">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="lat"
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={40}
                unit="ms"
              />
              <YAxis
                yAxisId="risk"
                orientation="right"
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip {...CHART_TOOLTIP_PROPS} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#7c7c7c" }} />
              <Bar
                yAxisId="lat"
                dataKey="latencyMs"
                name="Latency"
                fill={CHART_LAT}
                opacity={0.55}
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="risk"
                type="monotone"
                dataKey="cumulativeRisk"
                name="Σ risk"
                stroke={CHART_PRIMARY}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {layers.length > 0 ? (
        <div className="rounded-md border border-border p-3 xl:col-span-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Guardrail layer fail rate (campaign)
          </p>
          <div className="h-[200px] w-full" role="img" aria-label="Layer fail rates">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={layers}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid {...CHART_GRID} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="layer"
                  width={120}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...CHART_TOOLTIP_PROPS} />
                <Bar
                  dataKey="failRate"
                  name="Fail %"
                  fill={CHART_CRITICAL}
                  radius={[0, 2, 2, 0]}
                  barSize={14}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
