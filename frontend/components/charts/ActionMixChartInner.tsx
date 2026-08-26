"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ActionSlice } from "@/lib/enterpriseAnalytics";
import { CHART_AXIS_TICK, CHART_GRID, CHART_TOOLTIP_STYLE } from "@/lib/chartTheme";

export default function ActionMixChartInner({ data }: { data: ActionSlice[] }) {
  return (
    <div className="h-[220px] w-full" role="img" aria-label="Containment action mix">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            allowDecimals={false}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [v, "Events"]} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
