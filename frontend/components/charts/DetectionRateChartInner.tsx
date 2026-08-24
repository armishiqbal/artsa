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
import type { DetectionPoint } from "@/lib/detectionAnalytics";

export default function DetectionRateChartInner({ data }: { data: DetectionPoint[] }) {
  return (
    <div className="h-48 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)}%`,
              name === "artsaRate" ? "ARTSA detection" : "Static baseline",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px" }}
            formatter={(value) => (value === "artsaRate" ? "ARTSA (live)" : "Static baseline")}
          />
          <Line
            type="monotone"
            dataKey="artsaRate"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            name="artsaRate"
          />
          <Line
            type="monotone"
            dataKey="baselineRate"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            dot={false}
            name="baselineRate"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
