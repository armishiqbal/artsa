"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RoundTrendPoint } from "@/lib/redTeamAnalytics";
import { CHART_AXIS_TICK, CHART_CRITICAL, CHART_GRID, CHART_PRIMARY, CHART_TOOLTIP_PROPS } from "@/lib/chartTheme";

export default function RedTeamRoundTrendChartInner({ data }: { data: RoundTrendPoint[] }) {
  return (
    <div className="h-[220px] w-full" role="img" aria-label="Attack versus defense by round">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 10]}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip {...CHART_TOOLTIP_PROPS} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#7c7c7c" }} />
          <Line
            type="monotone"
            dataKey="attack"
            name="Attack success"
            stroke={CHART_CRITICAL}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="defense"
            name="Defense quality"
            stroke={CHART_PRIMARY}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
