"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_AXIS_TICK, CHART_CRITICAL, CHART_GRID, CHART_HIGH, CHART_PRIMARY, CHART_TOOLTIP_PROPS } from "@/lib/chartTheme";

interface RiskTrendChartInnerProps {
  data: Array<{ name: number; label?: string; score: number }>;
}

export default function RiskTrendChartInner({ data }: RiskTrendChartInnerProps) {
  return (
    <div className="h-[280px] w-full" role="img" aria-label="Risk trend over time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="riskGradientEnterprise" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.4} />
              <stop offset="55%" stopColor={CHART_PRIMARY} stopOpacity={0.08} />
              <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...CHART_GRID} />
          <XAxis
            dataKey="label"
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[0, 100]}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v) => `${v}`}
          />
          <ReferenceLine
            y={80}
            stroke={CHART_CRITICAL}
            strokeDasharray="4 4"
            strokeOpacity={0.7}
            label={{ value: "CRIT", fill: CHART_CRITICAL, fontSize: 9, position: "insideTopRight" }}
          />
          <ReferenceLine
            y={50}
            stroke={CHART_HIGH}
            strokeDasharray="4 4"
            strokeOpacity={0.55}
            label={{ value: "HIGH", fill: CHART_HIGH, fontSize: 9, position: "insideTopRight" }}
          />
          <Tooltip
            {...CHART_TOOLTIP_PROPS}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as { label?: string } | undefined;
              return p?.label ?? "Sample";
            }}
            formatter={(v: number) => [`${Number(v).toFixed(1)} / 100`, "Risk score"]}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={CHART_PRIMARY}
            fill="url(#riskGradientEnterprise)"
            strokeWidth={2.25}
            activeDot={{ r: 4, stroke: "#fff", strokeWidth: 1 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
