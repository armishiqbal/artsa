"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VolumeBucket } from "@/lib/enterpriseAnalytics";
import { CHART_AXIS_TICK, CHART_CRITICAL, CHART_GRID, CHART_HIGH, CHART_MUTED, CHART_TOOLTIP_PROPS } from "@/lib/chartTheme";

export default function VolumeStackedChartInner({ data }: { data: VolumeBucket[] }) {
  const rows = data.map((b) => ({
    ...b,
    other: Math.max(0, b.count - b.critical - b.high),
  }));

  return (
    <div className="h-[220px] w-full" role="img" aria-label="Event volume by time">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} minTickGap={20} />
          <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={28} />
          <Tooltip {...CHART_TOOLTIP_PROPS} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#7c7c7c" }} />
          <Bar dataKey="critical" stackId="v" fill={CHART_CRITICAL} name="Critical" maxBarSize={36} />
          <Bar dataKey="high" stackId="v" fill={CHART_HIGH} name="High" maxBarSize={36} />
          <Bar dataKey="other" stackId="v" fill={CHART_MUTED} name="Other" radius={[3, 3, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
