"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RankedItem } from "@/lib/enterpriseAnalytics";
import { CHART_AXIS_TICK, CHART_GRID, CHART_PRIMARY, CHART_TOOLTIP_STYLE } from "@/lib/chartTheme";

export default function RankedBarChartInner({
  data,
  valueKey = "maxRisk",
}: {
  data: RankedItem[];
  valueKey?: "maxRisk" | "count" | "avgRisk";
}) {
  const rows = [...data].reverse();
  return (
    <div className="h-[240px] w-full" role="img" aria-label="Ranked risk items">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid {...CHART_GRID} horizontal={false} vertical />
          <XAxis
            type="number"
            domain={valueKey === "count" ? [0, "auto"] : [0, 100]}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(v: number, _n, item) => {
              const row = item?.payload as RankedItem | undefined;
              return [
                valueKey === "count"
                  ? `${v} events`
                  : `R${v} · n${row?.count ?? 0}`,
                valueKey === "count" ? "Volume" : "Peak risk",
              ];
            }}
          />
          <Bar dataKey={valueKey} fill={CHART_PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
