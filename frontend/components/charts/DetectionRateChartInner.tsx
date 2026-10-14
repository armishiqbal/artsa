"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DetectionPoint } from "@/lib/detectionAnalytics";
import { CHART_AXIS_TICK, CHART_GRID, CHART_PRIMARY, CHART_TOOLTIP_PROPS } from "@/lib/chartTheme";

export default function DetectionRateChartInner({ data }: { data: DetectionPoint[] }) {
  return (
    <div className="h-[260px] w-full" role="img" aria-label="Detection rate across completed campaign outcomes">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            {...CHART_TOOLTIP_PROPS}
            formatter={(value: number) => [`${Number(value).toFixed(1)}%`, "Detection rate"]}
            labelFormatter={(label, payload) => {
              const judged = payload?.[0]?.payload?.judged;
              return `${String(label)}${typeof judged === "number" ? ` · ${judged} judged` : ""}`;
            }}
          />
          <Bar dataKey="detectionRate" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
