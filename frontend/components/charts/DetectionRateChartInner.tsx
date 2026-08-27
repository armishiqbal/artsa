"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DetectionPoint } from "@/lib/detectionAnalytics";
import { CHART_AXIS_TICK, CHART_GRID, CHART_MUTED, CHART_PRIMARY, CHART_TOOLTIP_PROPS } from "@/lib/chartTheme";

export default function DetectionRateChartInner({ data }: { data: DetectionPoint[] }) {
  return (
    <div className="h-[260px] w-full" role="img" aria-label="Detection rate versus static baseline">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="detectFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...CHART_GRID} />
          <XAxis
            dataKey="label"
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            {...CHART_TOOLTIP_PROPS}
            formatter={(value: number, name: string) => [
              `${Number(value).toFixed(1)}%`,
              name === "artsaRate" ? "ARTSA detection" : "Static baseline",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", color: "#7c7c7c" }}
            formatter={(value) => (value === "artsaRate" ? "ARTSA (live)" : "Static baseline 62%")}
          />
          <Area
            type="monotone"
            dataKey="artsaRate"
            stroke={CHART_PRIMARY}
            fill="url(#detectFill)"
            strokeWidth={2.25}
            name="artsaRate"
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="baselineRate"
            stroke={CHART_MUTED}
            strokeWidth={1.75}
            strokeDasharray="6 4"
            dot={false}
            name="baselineRate"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
